"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, logAudit } from "@/lib/auth";

async function guard() {
  const user = await getSessionUser();
  // Laporan dibaca ADMIN & KEPSEK (laporan ke kepala sekolah).
  if (!user || (user.role !== "ADMIN" && user.role !== "KEPSEK")) {
    throw new Error("Hanya admin & kepala sekolah");
  }
  return user;
}

/** Ubah status laporan: BARU → DIBACA → DITINDAKLANJUTI. */
export async function setFeedbackStatus(formData: FormData) {
  const user = await guard();
  const id = BigInt(String(formData.get("id") ?? "0"));
  const status = String(formData.get("status") ?? "");
  if (!["BARU", "DIBACA", "DITINDAKLANJUTI"].includes(status)) {
    throw new Error("Status tidak valid");
  }
  await prisma.parentFeedback.update({
    where: { id },
    data: { status, readAt: status === "BARU" ? null : new Date() },
  });
  await logAudit({
    userId: user.id,
    action: "FEEDBACK_STATUS",
    entity: "parent_feedbacks",
    entityId: String(id),
    detail: { status },
  });
  // Tandai notifikasi admin terkait sudah dibaca.
  await prisma.notification.updateMany({
    where: { kind: "feedback_baru", link: "/admin/laporan", readAt: null },
    data: { readAt: new Date() },
  }).catch(() => {});
  revalidatePath("/admin/laporan");
  redirect("/admin/laporan");
}

/** Kelola templat (admin only): tambah / nonaktifkan. */
export async function addTemplate(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new Error("Hanya admin");
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  if (!label) redirect("/admin/laporan?err=" + encodeURIComponent("Label templat wajib diisi"));
  const sasaranRaw = String(formData.get("sasaran") ?? "SEMUA");
  const sasaran = sasaranRaw === "ORTU" || sasaranRaw === "SISWA" ? sasaranRaw : "SEMUA";
  const max = await prisma.feedbackTemplate.aggregate({ _max: { urutan: true } });
  await prisma.feedbackTemplate.create({
    data: { label, sasaran, urutan: (max._max.urutan ?? 0) + 1 },
  });
  await logAudit({ userId: user.id, action: "FEEDBACK_TEMPLAT_TAMBAH", entity: "feedback_templates", entityId: label });
  revalidatePath("/admin/laporan");
  revalidatePath("/umpan-balik");
  redirect("/admin/laporan?msg=" + encodeURIComponent("Templat ditambahkan"));
}

export async function toggleTemplate(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new Error("Hanya admin");
  const id = BigInt(String(formData.get("id") ?? "0"));
  const t = await prisma.feedbackTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.feedbackTemplate.update({ where: { id }, data: { isActive: !t.isActive } });
  revalidatePath("/admin/laporan");
  revalidatePath("/umpan-balik");
}
