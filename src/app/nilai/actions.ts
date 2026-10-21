"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, logAudit } from "@/lib/auth";
import { canManageAssignment } from "@/lib/academic";
import { recomputeReports, syncAutoTpScores } from "@/lib/gradebook";

async function guard(assignmentIdRaw: string | FormDataEntryValue | null) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const assignmentId = BigInt(String(assignmentIdRaw ?? "0"));
  if (!assignmentId || !(await canManageAssignment(user, assignmentId))) {
    throw new Error("Aksi ditolak");
  }
  return { user, assignmentId };
}

const clampScore = (raw: FormDataEntryValue | null) => {
  const v = Number(String(raw ?? "").replace(",", "."));
  if (Number.isNaN(v) || v < 0 || v > 100) return null;
  return Math.round(v * 100) / 100;
};

/* ── sel matriks TP ── */
export async function setTpScore(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId"));
  const tpId = BigInt(String(formData.get("tpId") ?? "0"));
  const studentId = BigInt(String(formData.get("studentId") ?? "0"));
  const back = () => { revalidatePath(`/nilai?a=${assignmentId}`); redirect(`/nilai?a=${assignmentId}`); };
  const tp = await prisma.learningTarget.findFirst({ where: { id: tpId, assignmentId } });
  if (!tp) throw new Error("TP bukan di assignment ini");
  const raw = String(formData.get("score") ?? "").trim();
  if (raw === "") {
    await prisma.tpScore.deleteMany({ where: { tpId, studentId } });
  } else {
    const score = clampScore(raw);
    if (score === null) back();
    await prisma.tpScore.upsert({
      where: { tpId_studentId: { tpId, studentId } },
      create: { tpId, studentId, score: score!, source: "MANUAL" },
      update: { score: score!, source: "MANUAL" },
    });
  }
  await recomputeReports(assignmentId);
  await logAudit({ userId: user.id, action: "TP_SKOR", entity: "tp_scores", entityId: `${tpId}:${studentId}` });
  back();
}

/* ── flag validasi TR / OP ── */
export async function toggleFlag(formData: FormData) {
  const { assignmentId } = await guard(formData.get("assignmentId"));
  const tpId = BigInt(String(formData.get("tpId") ?? "0"));
  const studentId = BigInt(String(formData.get("studentId") ?? "0"));
  const type = formData.get("type") === "SANGAT_TERCAPAI" ? "SANGAT_TERCAPAI" : "PERLU_PENINGKATAN";
  const existing = await prisma.tpFlag.findUnique({
    where: { tpId_studentId_type: { tpId, studentId, type } },
  });
  if (existing) await prisma.tpFlag.delete({ where: { id: existing.id } });
  else await prisma.tpFlag.create({ data: { tpId, studentId, type } });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}`);
}

/* ── rekap otomatis ── */
export async function recalculate(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId"));
  const force = formData.get("force") === "1";
  const nTp = await syncAutoTpScores(assignmentId, force);
  const nRep = await recomputeReports(assignmentId);
  await logAudit({ userId: user.id, action: "REKAP_HITUNG", entity: "assignments", entityId: String(assignmentId), detail: { tp: nTp, rapor: nRep, force } });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}&ok=rekap&n=${nTp}`);
}

/* ── koreksi rapor manual ── */
export async function setReportScore(formData: FormData) {
  const { user, assignmentId } = await guard(formData.get("assignmentId"));
  const studentId = BigInt(String(formData.get("studentId") ?? "0"));
  const score = clampScore(formData.get("score"));
  if (score === null) redirect(`/nilai?a=${assignmentId}&err=nilai`);
  const lama = await prisma.reportScore.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
  });
  await prisma.reportScore.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    create: { assignmentId, studentId, score: score!, isManual: true },
    update: { score: score!, isManual: true },
  });
  await logAudit({
    userId: user.id, action: "RAPOR_KOREKSI", entity: "report_scores", entityId: String(studentId),
    detail: { lama: lama ? Number(lama.score) : null, baru: score },
  });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}`);
}

/* ── asesmen manual (UH / praktik / nilai CBT) ── */
export async function addAssessment(formData: FormData) {
  const { assignmentId } = await guard(formData.get("assignmentId"));
  const nama = String(formData.get("nama") ?? "").trim();
  if (!nama) redirect(`/nilai?a=${assignmentId}&err=nama`);
  const tpId = formData.get("tpId") ? BigInt(String(formData.get("tpId"))) : null;
  const keterangan = String(formData.get("keterangan") ?? "").trim();
  await prisma.manualAssessment.create({ data: { assignmentId, nama, keterangan, tpId } });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}`);
}

export async function deleteAssessment(formData: FormData) {
  const id = BigInt(String(formData.get("id") ?? "0"));
  const a = await prisma.manualAssessment.findUnique({ where: { id } });
  if (!a) throw new Error("Tidak ditemukan");
  const { assignmentId } = await guard(String(a.assignmentId));
  await prisma.manualAssessment.delete({ where: { id } });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}`);
}

export async function setAssessmentScore(formData: FormData) {
  const id = BigInt(String(formData.get("assessmentId") ?? "0"));
  const a = await prisma.manualAssessment.findUnique({ where: { id } });
  if (!a) throw new Error("Tidak ditemukan");
  const { user, assignmentId } = await guard(String(a.assignmentId));
  const studentId = BigInt(String(formData.get("studentId") ?? "0"));
  const score = clampScore(formData.get("score"));
  const lama = await prisma.grade.findFirst({ where: { manualAssessmentId: id, studentId } });
  if (score === null) redirect(`/nilai?a=${assignmentId}&err=nilai`);
  if (lama) await prisma.grade.update({ where: { id: lama.id }, data: { score: score! } });
  else
    await prisma.grade.create({
      data: { target: "MANUAL", manualAssessmentId: id, studentId, score: score!, gradedById: user.id },
    });
  await syncAutoTpScores(assignmentId); // asesmen yg menaut TP → ikut agregasi
  await recomputeReports(assignmentId);
  await logAudit({
    userId: user.id, action: "ASPEK_SKOR", entity: "grades", entityId: `${id}:${studentId}`,
    detail: { lama: lama ? Number(lama.score) : null, baru: score },
  });
  revalidatePath(`/nilai?a=${assignmentId}`);
  redirect(`/nilai?a=${assignmentId}`);
}
