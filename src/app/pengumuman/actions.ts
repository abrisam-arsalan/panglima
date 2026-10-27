"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";
import { notifyClass } from "@/lib/notify";

export async function createAnnouncement(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || !["ADMIN", "GURU"].includes(user.role)) throw new Error("Tidak berhak");
  const judul = String(formData.get("judul") ?? "").trim();
  const isi = String(formData.get("isi") ?? "").trim();
  if (!judul || !isi) redirect("/pengumuman?err=1");

  const cidStr = String(formData.get("classId") ?? "").trim();
  const classIdRaw = BigInt(/^\d+$/.test(cidStr) ? cidStr : "0");
  let classId: bigint | null = classIdRaw || null;
  if (classId) {
    if (user.role === "GURU") {
      const boleh =
        (await prisma.assignment.count({ where: { classId, teacherId: user.id } })) > 0 ||
        (await prisma.class.count({ where: { id: classId, homeroomUserId: user.id } })) > 0;
      if (!boleh) throw new Error("Bukan rombel-mu");
    }
  } else if (user.role !== "ADMIN") {
    throw new Error("Hanya admin yang bisa pengumuman seluruh sekolah");
  }

  const p = await prisma.announcement.create({
    data: { judul, isi, target: classId ? "KELAS" : "SEMUA", classId, authorId: user.id },
  });
  await logAudit({ userId: user.id, action: "PENGUMUMAN_BARU", entity: "announcements", entityId: String(p.id) });

  // Notifikasi hemat: KELAS → sebar ke anggota kelas (notifyClass batch);
  // SEMUA (sekolah) → TIDAK sebar per-user (N+1 untuk ribuan akun).
  // Halaman /pengumuman + badge di dashboard membaca Announcement langsung.
  if (classId) {
    await notifyClass(classId, "pengumuman", `📢 ${judul}`, "/pengumuman");
  }
  revalidatePath("/pengumuman");
  redirect("/pengumuman");
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user) redirect("/login");
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const p = await prisma.announcement.findUnique({ where: { id } });
  if (!p) return;
  if (user.role !== "ADMIN" && p.authorId !== user.id) throw new Error("Bukan punyamu");
  await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ userId: user.id, action: "PENGUMUMAN_HAPUS", entity: "announcements", entityId: String(id) });
  revalidatePath("/pengumuman");
}
