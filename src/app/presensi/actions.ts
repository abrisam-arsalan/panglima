"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, logAudit } from "@/lib/auth";
import { AttendanceStatus, ClassSessionStatus } from "@prisma/client";

export async function openSession(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "GURU" && user.role !== "ADMIN")) {
    redirect("/login");
  }

  const scheduleId = BigInt(String(formData.get("scheduleId") ?? "0"));
  const dateStr = String(formData.get("date") ?? "").trim();
  if (!scheduleId || !dateStr) redirect("/presensi");

  // Tolak tanggal di masa depan — presensi hanya untuk hari berjalan / yang lewat.
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr > todayStr) throw new Error("Tidak bisa membuka presensi untuk tanggal di masa depan");

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { assignment: true },
  });
  if (!schedule) throw new Error("Jadwal tidak ditemukan");

  if (user.role === "GURU" && schedule.assignment.teacherId !== user.id) {
    throw new Error("Bukan penugasan mengajar Anda");
  }

  const sessionDate = new Date(`${dateStr}T00:00:00.000Z`);

  // Sesi idempoten (unique scheduleId + date)
  let session = await prisma.classSession.findUnique({
    where: { scheduleId_date: { scheduleId, date: sessionDate } },
  });

  if (!session) {
    session = await prisma.classSession.create({
      data: {
        scheduleId,
        teacherId: user.id,
        date: sessionDate,
        materi: "",
        catatanKelas: "",
        status: ClassSessionStatus.DIBUKA,
      },
    });

    // Otomatis masukkan semua siswa kelas terkait dengan status default HADIR
    const students = await prisma.user.findMany({
      where: {
        classId: schedule.assignment.classId,
        role: "SISWA",
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (students.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: students.map((s) => ({
          sessionId: session!.id,
          studentId: s.id,
          status: AttendanceStatus.HADIR,
        })),
        skipDuplicates: true,
      });
    }

    await logAudit({
      userId: user.id,
      action: "PRESENSI_BUKA_SESI",
      entity: "class_sessions",
      entityId: String(session.id),
      detail: { scheduleId: String(scheduleId), date: dateStr },
    });
  }

  redirect(`/presensi?session=${session.id}`);
}

export async function saveAttendance(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "GURU" && user.role !== "ADMIN")) {
    redirect("/login");
  }

  const sessionId = BigInt(String(formData.get("sessionId") ?? "0"));
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { schedule: { include: { assignment: true } } },
  });
  if (!session) throw new Error("Sesi tidak ditemukan");

  // Sesi SELESAI = riwayat terkunci. Koreksi hanya via admin (buka kembali dulu).
  if (session.status === ClassSessionStatus.SELESAI && user.role !== "ADMIN") {
    throw new Error("Sesi sudah selesai dan terkunci. Hubungi admin untuk koreksi.");
  }

  if (user.role === "GURU" && session.schedule.assignment.teacherId !== user.id) {
    throw new Error("Akses ditolak");
  }

  const materi = String(formData.get("materi") ?? "").trim();
  const catatanKelas = String(formData.get("catatanKelas") ?? "").trim();
  const markFinished = formData.get("finish") === "1";

  // Ambil semua records untuk diupdate
  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId },
  });

  for (const r of records) {
    const rawStatus = formData.get(`status_${r.studentId}`) as AttendanceStatus | null;
    const keterangan = String(formData.get(`ket_${r.studentId}`) ?? "").trim();
    const validStatus =
      rawStatus && Object.values(AttendanceStatus).includes(rawStatus)
        ? rawStatus
        : AttendanceStatus.HADIR;

    await prisma.attendanceRecord.update({
      where: { id: r.id },
      data: {
        status: validStatus,
        keterangan: keterangan.slice(0, 255),
      },
    });
  }

  await prisma.classSession.update({
    where: { id: sessionId },
    data: {
      materi,
      catatanKelas,
      status: markFinished ? ClassSessionStatus.SELESAI : ClassSessionStatus.DIBUKA,
    },
  });

  await logAudit({
    userId: user.id,
    action: markFinished ? "PRESENSI_SELESAI" : "PRESENSI_SIMPAN",
    entity: "class_sessions",
    entityId: String(sessionId),
  });

  revalidatePath("/presensi");
  revalidatePath("/rekap-presensi");
  redirect(`/presensi?session=${sessionId}&ok=1`);
}
