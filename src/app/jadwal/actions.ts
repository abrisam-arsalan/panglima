"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";

export async function addSchedule(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || user.role !== "ADMIN") throw new Error("Hanya admin");
  const assignmentId = toBigInt(formData.get("assignmentId")) ?? BigInt(0);
  const day = Number(formData.get("day"));
  const startTime = String(formData.get("start") ?? "").trim();
  const endTime = String(formData.get("end") ?? "").trim();
  const room = String(formData.get("room") ?? "").trim() || null;
  if (!assignmentId || day < 0 || day > 6 || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    redirect(`/jadwal?a=${assignmentId}`);
  }
  if (startTime >= endTime) {
    redirect(`/jadwal?a=${assignmentId}&err=${encodeURIComponent("Jam selesai harus lebih lambat dari jam mulai")}`);
  }
  const exists = await prisma.schedule.findUnique({
    where: { assignmentId_day_startTime: { assignmentId, day, startTime } },
  });
  if (!exists) {
    await prisma.schedule.create({ data: { assignmentId, day, startTime, endTime, room } });
    await logAudit({ userId: user.id, action: "JADWAL_TAMBAH", entity: "schedules", entityId: String(assignmentId) });
  } else if (!exists.isActive) {
    // Slot pernah dinonaktifkan → aktifkan kembali (bukan duplikat).
    await prisma.schedule.update({
      where: { id: exists.id },
      data: { isActive: true, endTime, room },
    });
    await logAudit({ userId: user.id, action: "JADWAL_AKTIF", entity: "schedules", entityId: String(exists.id) });
  }
  revalidatePath("/jadwal");
  redirect(`/jadwal?a=${assignmentId}`);
}

/**
 * V-P1-3: jadwal TIDAK dihapus (RESTRICT melindungi riwayat presensi),
 * melainkan dinonaktifkan. Sesi lama tetap terbaca sebagai riwayat.
 * Jadwal tanpa sesi SAMA SEKALI boleh dihapus fisik bila diminta (?purge=1).
 */
export async function deleteSchedule(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || user.role !== "ADMIN") throw new Error("Hanya admin");
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const purge = String(formData.get("purge") ?? "") === "1";

  const sesi = await prisma.classSession.count({ where: { scheduleId: id } });
  if (sesi > 0) {
    await prisma.schedule.update({ where: { id }, data: { isActive: false } });
    await logAudit({ userId: user.id, action: "JADWAL_NONAKTIF", entity: "schedules", entityId: String(id), detail: { sesi } });
  } else if (purge) {
    await prisma.schedule.deleteMany({ where: { id } });
    await logAudit({ userId: user.id, action: "JADWAL_HAPUS", entity: "schedules", entityId: String(id) });
  } else {
    await prisma.schedule.update({ where: { id }, data: { isActive: false } });
    await logAudit({ userId: user.id, action: "JADWAL_NONAKTIF", entity: "schedules", entityId: String(id) });
  }
  revalidatePath("/jadwal");
  redirect(`/jadwal?a=${assignmentId}`);
}

/** Aktifkan kembali jadwal nonaktif. */
export async function activateSchedule(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || user.role !== "ADMIN") throw new Error("Hanya admin");
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  await prisma.schedule.update({ where: { id }, data: { isActive: true } });
  await logAudit({ userId: user.id, action: "JADWAL_AKTIF", entity: "schedules", entityId: String(id) });
  revalidatePath("/jadwal");
  redirect(`/jadwal?a=${assignmentId}`);
}
