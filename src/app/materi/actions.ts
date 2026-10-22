"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";
import { canManageAssignment } from "@/lib/academic";
import { removeStored, saveFile } from "@/lib/storage";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const back = (a: bigint) => redirect(`/materi?a=${a}`);

async function guard(assignmentIdStr: string | null) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user) throw new Error("Wajib login");
  const assignmentId = BigInt(assignmentIdStr ?? "0");
  if (!assignmentId) throw new Error("Assignment tidak valid");
  const allowed = await canManageAssignment(user, assignmentId);
  if (!allowed) throw new Error("Akses ditolak");
  return { user, assignmentId };
}

/** TP harus milik assignment yang sama — cegah taut silangassignment. */
async function resolveTp(assignmentId: bigint, raw: string | null): Promise<bigint | null> {
  const s = String(raw ?? "").trim();
  if (!s || !/^\d+$/.test(s)) return null;
  const tp = await prisma.learningTarget.findFirst({
    where: { id: BigInt(s), assignmentId },
    select: { id: true },
  });
  return tp?.id ?? null;
}

export async function createMateri(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId")?.toString() ?? null);
  const judul = clean(formData.get("judul"), 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 20000);
  const status = formData.get("status") === "TERBIT" ? "TERBIT" : "DRAF";
  const tpId = await resolveTp(assignmentId, formData.get("tpId")?.toString() ?? null);
  if (!judul || !body) back(assignmentId);

  const max = await prisma.material.aggregate({
    where: { assignmentId },
    _max: { urutan: true },
  });
  const m = await prisma.material.create({
    data: {
      assignmentId,
      judul,
      body,
      status,
      publishAt: status === "TERBIT" ? new Date() : null,
      urutan: (max._max.urutan ?? 0) + 1,
      createdById: user.id,
      ...(tpId ? { tpId } : {}),
    },
  });
  await logAudit({ userId: user.id, action: "MATERI_BARU", entity: "materials", entityId: String(m.id) });
  if (status === "TERBIT") await notifyMateri(assignmentId, judul);
  revalidatePath(`/materi`);
  back(assignmentId);
}

async function notifyMateri(assignmentId: bigint, judul: string) {
  const { notifyClass } = await import("@/lib/notify");
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { subject: true, class: true },
  });
  if (a) await notifyClass(a.classId, "materi_baru", `ðŸ“– Materi baru: ${judul} (${a.class.name} Â· ${a.subject.name})`, "/materi");
}

export async function updateMateri(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId")?.toString() ?? null);
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const judul = clean(formData.get("judul"), 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 20000);
  const status = formData.get("status") === "TERBIT" ? "TERBIT" : "DRAF";
  const tpId = await resolveTp(assignmentId, formData.get("tpId")?.toString() ?? null);
  if (!id || !judul || !body) back(assignmentId);

  const prev = await prisma.material.findFirst({ where: { id, assignmentId } });
  if (!prev) throw new Error("Materi tidak ditemukan");

  await prisma.material.update({
    where: { id },
    data: {
      judul,
      body,
      status,
      publishAt: status === "TERBIT" && !prev.publishAt ? new Date() : prev.publishAt,
      tpId,
    },
  });
  await logAudit({ userId: user.id, action: "MATERI_UBAH", entity: "materials", entityId: String(id) });
  if (prev.status === "DRAF" && status === "TERBIT") await notifyMateri(assignmentId, judul);
  revalidatePath(`/materi`);
  back(assignmentId);
}

export async function deleteMateri(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId")?.toString() ?? null);
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  await prisma.material.updateMany({
    where: { id, assignmentId },
    data: { deletedAt: new Date() },
  });
  await logAudit({ userId: user.id, action: "MATERI_HAPUS", entity: "materials", entityId: String(id) });
  revalidatePath(`/materi`);
  back(assignmentId);
}

export async function uploadMateriFile(formData: FormData) {
  const { assignmentId } = await guard(formData.get("assignmentId")?.toString() ?? null);
  const materialId = toBigInt(formData.get("materialId")) ?? BigInt(0);
  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof Blob) || file.size === 0) {
    back(assignmentId);
    return;
  }
  const f = file as File;
  if (f.size > 20 * 1024 * 1024) redirect(`/materi?a=${assignmentId}&err=Ukuran+maks+20MB`);

  const bytes = Buffer.from(await f.arrayBuffer());
  const stored = await saveFile(bytes, f.name || "file");
  await prisma.materialFile.create({
    data: {
      materialId,
      nama: (f.name || "file").slice(0, 255),
      storedName: stored.storedName,
      mime: f.type || "application/octet-stream",
      sizeBytes: BigInt(f.size),
    },
  });
  revalidatePath(`/materi`);
  back(assignmentId);
}

export async function markRead(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || user.role !== "SISWA") throw new Error("Hanya siswa");
  const materialId = toBigInt(formData.get("materialId")) ?? BigInt(0);
  const m = await prisma.material.findFirst({
    where: { id: materialId, deletedAt: null, status: "TERBIT" },
    include: { assignment: { select: { classId: true } } },
  });
  if (!m) throw new Error("Materi tidak ada / belum terbit");
  if (user.classId !== m.assignment.classId) throw new Error("Bukan materi kelasmu");
  await prisma.materialRead.upsert({
    where: { materialId_userId: { materialId, userId: user.id } },
    create: { materialId, userId: user.id },
    update: {},
  });
  revalidatePath("/materi");
}

export async function deleteMateriFile(formData: FormData) {
  const { assignmentId } = await guard(formData.get("assignmentId")?.toString() ?? null);
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const f = await prisma.materialFile.findFirst({
    where: { id, material: { assignmentId } },
  });
  if (f) {
    await prisma.materialFile.delete({ where: { id } });
    await removeStored(f.storedName);
  }
  revalidatePath(`/materi`);
}
