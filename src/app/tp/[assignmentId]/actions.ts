"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit } from "@/lib/auth";
import { canManageAssignment } from "@/lib/academic";

async function guardEdit(assignmentId: bigint) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canManageAssignment(user, assignmentId))) {
    throw new Error("Bukan rombel/mapel-mu");
  }
  return user;
}

export async function createTp(formData: FormData) {
  const assignmentId = toBigInt(formData.get("assignmentId")) ?? BigInt(0);
  const code = String(formData.get("code") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const user = await guardEdit(assignmentId);
  if (!code || !content) redirect(`/tp/${assignmentId}?err=1`);

  const max = await prisma.learningTarget.aggregate({
    where: { assignmentId },
    _max: { urutan: true },
  });
  await prisma.learningTarget.create({
    data: { assignmentId, code, content, urutan: (max._max.urutan ?? 0) + 1 },
  });
  await logAudit({ userId: user.id, action: "TP_BAU", entity: "learning_targets", entityId: code });
  revalidatePath(`/tp/${assignmentId}`);
  redirect(`/tp/${assignmentId}`);
}

export async function updateTp(formData: FormData) {
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const assignmentId = toBigInt(formData.get("assignmentId")) ?? BigInt(0);
  const code = String(formData.get("code") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const urutan = Math.max(0, Number(formData.get("urutan") ?? 0) || 0);
  const user = await guardEdit(assignmentId);
  if (!code || !content) redirect(`/tp/${assignmentId}?err=1`);

  const tp = await prisma.learningTarget.findUnique({ where: { id } });
  if (!tp || tp.assignmentId !== assignmentId) redirect(`/tp/${assignmentId}`);
  await prisma.learningTarget.update({ where: { id }, data: { code, content, urutan } });
  await logAudit({
    userId: user.id, action: "TP_UBAH", entity: "learning_targets", entityId: String(id),
    detail: { lama: tp.code, baru: code },
  });
  revalidatePath(`/tp/${assignmentId}`);
  redirect(`/tp/${assignmentId}`);
}

/**
 * Impor TP dari file template import rapor KEMENTERIAN (.xlsx):
 * scan 12 baris awal → sel "TP.xxxx" = kode; teks di sel atasnya = isi TP.
 * Bonus: hitung baris roster (kolom NISN) utk laporan kecocokan.
 */
export async function importTpTemplate(formData: FormData) {
  const assignmentId = toBigInt(formData.get("assignmentId")) ?? BigInt(0);
  const user = await guardEdit(assignmentId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/tp/${assignmentId}?err=1`);
  if (file.size > 2 * 1024 * 1024) redirect(`/tp/${assignmentId}?imp=toobig`);

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) redirect(`/tp/${assignmentId}?imp=empty`);

  const found: { code: string; content: string }[] = [];
  let nisnCol = -1;
  let roster = 0;
  const maxRow = Math.min(ws.rowCount, 200);
  const maxCol = Math.min(ws.columnCount, 60);
  const cellText = (r: number, c: number) => {
    const v = ws.getRow(r).getCell(c).value;
    if (v === null || v === undefined) return "";
    return String(typeof v === "object" && "text" in (v as object) ? (v as { text: string }).text : v).trim();
  };
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const v = cellText(r, c);
      if (/^TP\.\d{2,5}$/i.test(v)) {
        const content = cellText(r - 1, c);
        found.push({ code: v.toUpperCase(), content: content.length >= 5 ? content : v });
      }
      if (!v) continue;
      if (v.toUpperCase() === "NISN") nisnCol = c;
      else if (nisnCol > 0 && r > 4 && /^\d{6,12}$/.test(v.replace(/\.0$/, ""))) roster++;
    }
  }

  let added = 0, skipped = 0;
  const existing = await prisma.learningTarget.findMany({ where: { assignmentId }, select: { code: true } });
  const have = new Set(existing.map((e) => e.code.toUpperCase()));
  const max = await prisma.learningTarget.aggregate({ where: { assignmentId }, _max: { urutan: true } });
  let urutan = max._max.urutan ?? 0;
  for (const t of found) {
    if (have.has(t.code)) { skipped++; continue; }
    have.add(t.code);
    await prisma.learningTarget.create({ data: { assignmentId, code: t.code, content: t.content, urutan: ++urutan } });
    added++;
  }
  await logAudit({ userId: user.id, action: "TP_IMPOR", entity: "learning_targets", entityId: String(assignmentId), detail: { added, skipped, roster } });
  revalidatePath(`/tp/${assignmentId}`);
  redirect(`/tp/${assignmentId}?imp=${added}&skip=${skipped}&roster=${roster}`);
}

export async function deleteTp(formData: FormData) {
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const assignmentId = toBigInt(formData.get("assignmentId")) ?? BigInt(0);
  const user = await guardEdit(assignmentId);
  await prisma.learningTarget.deleteMany({ where: { id, assignmentId } });
  await logAudit({ userId: user.id, action: "TP_HAPUS", entity: "learning_targets", entityId: String(id) });
  revalidatePath(`/tp/${assignmentId}`);
}
