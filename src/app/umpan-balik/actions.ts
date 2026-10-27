"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";

/**
 * Kirim umpan balik ORTU/SISWA → guru. Satu laporan BARU untuk admin/kepsek
 * dengan penanda sumber (ORTU/SISWA). Guru TIDAK diberi notifikasi langsung
 * (lindungi pengirim, tindak lanjut via kepsek/admin).
 * Siswa: guru harus mengajar kelasnya; childId otomatis = diri sendiri.
 */
export async function sendFeedback(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || (user.role !== "ORTU" && user.role !== "SISWA")) {
    throw new Error("Hanya orang tua & siswa");
  }
  const sumber = user.role === "SISWA" ? "SISWA" : "ORTU";
  const teacherId = toBigInt(formData.get("teacherId")) ?? BigInt(0);
  const childIdRaw = String(formData.get("childId") ?? "").trim();
  // Gabung semua kotak catatan (note, note_1, ...) — ortu boleh tambah banyak.
  const notes: string[] = [];
  for (const [k, v] of formData.entries()) {
    if (k === "note" || /^note_\d+$/.test(k)) {
      const t = String(v).trim();
      if (t) notes.push(t);
    }
  }
  const note = notes.join("\n\n---\n\n").slice(0, 4000);
  const templateIds = formData.getAll("templates").map((v) => BigInt(String(v))).filter((v) => v > BigInt(0));

  if (!teacherId) redirect("/umpan-balik?err=" + encodeURIComponent("Pilih guru dulu"));
  if (!templateIds.length && !note) {
    redirect("/umpan-balik?err=" + encodeURIComponent("Pilih minimal 1 templat atau tulis catatan"));
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: "GURU", isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) throw new Error("Guru tidak valid");

  // Anak: siswa = diri sendiri; ortu = harus miliknya (bila dipilih).
  let childId: bigint | null = null;
  if (sumber === "SISWA") {
    childId = user.id;
  } else if (childIdRaw) {
    const link = await prisma.parentLink.findFirst({
      where: { parentId: user.id, childId: BigInt(childIdRaw) },
      select: { childId: true },
    });
    if (!link) throw new Error("Anak tidak valid");
    childId = link.childId;
  } else {
    const first = await prisma.parentLink.findFirst({
      where: { parentId: user.id },
      select: { childId: true },
    });
    childId = first?.childId ?? null;
  }

  // Siswa hanya boleh menilai guru yang mengajar KELASNYA.
  if (sumber === "SISWA" && user.classId) {
    const mengajar = await prisma.assignment.count({
      where: { teacherId: teacher.id, classId: user.classId },
    });
    if (!mengajar) throw new Error("Guru tersebut tidak mengajar kelasmu");
  }

  // Templat harus aktif + sesuai sasaran (SEMUA atau sasarannya) — anti suntikan.
  const validTemplates = templateIds.length
    ? await prisma.feedbackTemplate.findMany({
        where: { id: { in: templateIds }, isActive: true, sasaran: { in: ["SEMUA", sumber] } },
        select: { id: true },
      })
    : [];
  if (templateIds.length && !validTemplates.length) {
    redirect("/umpan-balik?err=" + encodeURIComponent("Templat tidak valid"));
  }

  const fb = await prisma.parentFeedback.create({
    data: {
      parentId: user.id,
      teacherId: teacher.id,
      childId,
      sumber,
      note: note || null,
      items: { create: validTemplates.map((t) => ({ templateId: t.id })) },
    },
  });

  await logAudit({
    userId: user.id,
    action: "FEEDBACK_KIRIM",
    entity: "parent_feedbacks",
    entityId: String(fb.id),
    detail: { sumber, guru: String(teacher.id), templat: validTemplates.length, adaCatatan: !!note },
  });

  // Beri tahu SEMUA admin (bukan guru): laporan baru masuk.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        kind: "feedback_baru",
        message: `💬 Umpan balik ${sumber === "SISWA" ? "siswa" : "ortu"} baru untuk guru (laporan #${fb.id})`,
        link: "/admin/laporan",
      })),
      skipDuplicates: true,
    }).catch(() => {});
  }

  revalidatePath("/umpan-balik");
  redirect("/umpan-balik?ok=1");
}
