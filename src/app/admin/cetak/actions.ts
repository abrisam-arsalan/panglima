"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSurface, logAudit } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";
import { planPts, normRombel } from "@/lib/pts";
import { syncAutoTpScores, recomputeReports } from "@/lib/gradebook";

/** Ambil CSV dari link Google Sheet (export?format=csv) atau teks tempel. */
async function fetchSheetCsv(input: string): Promise<string> {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) {
    const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const url = m ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv` : s;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Gagal mengunduh sheet (HTTP ${res.status}). Pastikan link "Anyone with the link".`);
    return await res.text();
  }
  return s;
}

const normNama = (s: string) => s.trim().toUpperCase().replace(/[^A-Z\s']/g, "").replace(/\s+/g, " ");

export async function previewPts(formData: FormData) {
  await requireAdminSurface("admin/cetak");
  const input = String(formData.get("sheet") ?? "");
  const label = String(formData.get("label") ?? "").trim() || "PTS";
  if (!input.trim()) redirect("/admin/cetak?err=" + encodeURIComponent("Tempel link Google Sheet / CSV / teks CSV dulu"));
  let text: string;
  try {
    text = await fetchSheetCsv(input);
  } catch (e) {
    redirect("/admin/cetak?err=" + encodeURIComponent(e instanceof Error ? e.message : "Gagal membaca sheet"));
  }
  const { rows, mapels, problems } = planPts(text);
  if (problems.length) redirect("/admin/cetak?err=" + encodeURIComponent(problems.join(" Â· ")));
  if (!rows.length) redirect("/admin/cetak?err=" + encodeURIComponent("Tidak ada baris siswa terbaca"));

  // Cocokkan nama â†’ siswa portal (per rombel), hitung statistik preview.
  const ctx = await currentSemester();
  const okRows = rows.filter((r) => r.status === "OK");
  const rombels = [...new Set(okRows.map((r) => r.rombel))];
  const siswa = await prisma.user.findMany({
    where: {
      role: "SISWA",
      deletedAt: null,
      ...(ctx ? { classRef: { academicYearId: ctx.year.id } } : {}),
    },
    select: { id: true, nama: true, classRef: { select: { name: true } } },
  });
  const byRombel = new Map<string, { id: bigint; nama: string }[]>();
  for (const sw of siswa) {
    const key = normRombel(sw.classRef?.name ?? "");
    if (!key) continue;
    const arr = byRombel.get(key) ?? [];
    arr.push({ id: sw.id, nama: sw.nama });
    byRombel.set(key, arr);
  }
  let cocok = 0;
  let takCocok = 0;
  const contohTakCocok: string[] = [];
  for (const r of okRows) {
    const pool = byRombel.get(r.rombel) ?? [];
    const hit = pool.find((p) => normNama(p.nama) === normNama(r.nama));
    if (hit) cocok++;
    else {
      takCocok++;
      if (contohTakCocok.length < 5) contohTakCocok.push(`${r.nama} (${r.rombel})`);
    }
  }

  const { encryptPreview } = await import("@/lib/pts-preview");
  const rev = await encryptPreview(text);
  await logAudit({ action: "PTS_PREVIEW", entity: "pts", entityId: label, detail: { baris: rows.length, mapels: mapels.length, cocok, takCocok } });
  const q = new URLSearchParams({ rev, label, cocok: String(cocok), takCocok: String(takCocok), mapels: String(mapels.length), baris: String(rows.length) });
  if (contohTakCocok.length) q.set("contoh", contohTakCocok.join(" | ").slice(0, 300));
  redirect(`/admin/cetak?${q.toString()}`);
}

export async function commitPts(formData: FormData) {
  const admin = await requireAdminSurface("admin/cetak");
  const rev = String(formData.get("rev") ?? "");
  const label = String(formData.get("label") ?? "").trim() || "PTS";
  const { decryptPreview } = await import("@/lib/pts-preview");
  const text = await decryptPreview(rev);
  if (!text) redirect("/admin/cetak?err=" + encodeURIComponent("Sesi preview kedaluwarsa â€” ulangi preview"));

  const { rows } = planPts(text);
  const ctx = await currentSemester();
  if (!ctx) redirect("/admin/cetak?err=" + encodeURIComponent("Tahun ajaran aktif belum diset"));

  // Cache: rombel â†’ assignment per mapel; siswa per rombel+nama.
  const subjectCache = new Map<string, bigint>();
  const allSubjects = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
  for (const s of allSubjects) {
    subjectCache.set(s.name.toUpperCase(), s.id);
    subjectCache.set(s.code.toUpperCase(), s.id);
  }
  const siswa = await prisma.user.findMany({
    where: { role: "SISWA", deletedAt: null, classRef: { academicYearId: ctx.year.id } },
    select: { id: true, nama: true, classRef: { select: { id: true, name: true } } },
  });
  const siswaByKey = new Map<string, { id: bigint; classId: bigint }>();
  for (const sw of siswa) {
    if (!sw.classRef) continue;
    siswaByKey.set(`${normRombel(sw.classRef.name)}|${normNama(sw.nama)}`, { id: sw.id, classId: sw.classRef.id });
  }
  const asgCache = new Map<string, bigint>();

  let ditulis = 0;
  let lewati = 0;
  const errors: string[] = [];
  const touchedAsg = new Set<bigint>();

  for (const r of rows) {
    if (r.status === "ERR") {
      lewati++;
      errors.push(`baris ${r.line}: ${r.reason}`);
      continue;
    }
    const hit = siswaByKey.get(`${r.rombel}|${normNama(r.nama)}`);
    if (!hit) {
      lewati++;
      if (errors.length < 50) errors.push(`baris ${r.line}: ${r.nama} (${r.rombel}) tak cocok siswa portal`);
      continue;
    }
    for (const cell of r.nilai) {
      // Mapel sheet â†’ subject portal (cocok nama; bila belum ada, BUAT subject + assignment tanpa guru? TIDAK â€”
      // nilai PTS butuh assignment. Subject dibuat, assignment dibuat TANPA guru bila belum ada? Assignment wajib
      // teacherId. Solusi: cari assignment mapelÃ—rombelÃ—semester apa pun gurunya; bila tak ada â†’ lewati + lapor.
      const subjectId = subjectCache.get(cell.mapel.toUpperCase());
      if (!subjectId) {
        if (errors.length < 50) errors.push(`baris ${r.line}: mapel '${cell.mapel}' belum ada di portal â€” tambahkan di Penugasan dulu`);
        lewati++;
        continue;
      }
      const asgKey = `${subjectId}|${hit.classId}`;
      let assignmentId = asgCache.get(asgKey);
      if (!assignmentId) {
        const asg = await prisma.assignment.findFirst({
          where: { subjectId, classId: hit.classId, semesterId: ctx.semester.id },
          select: { id: true },
        });
        if (!asg) {
          if (errors.length < 50) errors.push(`baris ${r.line}: penugasan ${cell.mapel} Ã— ${r.rombel} belum ada â€” buat di Penugasan dulu`);
          lewati++;
          continue;
        }
        assignmentId = asg.id;
        asgCache.set(asgKey, assignmentId);
      }
      // ManualAssessment "PTS <label>" per assignment (idempoten).
      const asesmen = await prisma.manualAssessment.upsert({
        where: { assignmentId_nama: { assignmentId, nama: label } },
        create: { assignmentId, nama: label, keterangan: "Impor PTS paper (Google Sheet)" },
        update: {},
      });
      await prisma.grade.upsert({
        where: { manualAssessmentId_studentId: { manualAssessmentId: asesmen.id, studentId: hit.id } },
        create: { target: "MANUAL", manualAssessmentId: asesmen.id, studentId: hit.id, score: cell.skor, gradedById: admin.id },
        update: { score: cell.skor },
      });
      touchedAsg.add(assignmentId);
      ditulis++;
    }
  }

  for (const asgId of touchedAsg) {
    await syncAutoTpScores(asgId).catch(() => {});
    await recomputeReports(asgId).catch(() => {});
  }
  await logAudit({ userId: admin.id, action: "PTS_IMPOR", entity: "pts", entityId: label, detail: { ditulis, lewati, errors: errors.length } });
  revalidatePath("/admin/cetak");
  revalidatePath("/nilai");
  const q = new URLSearchParams({ impor: "1", ditulis: String(ditulis), lewati: String(lewati), label });
  if (errors.length) q.set("rinci", errors.slice(0, 10).join(" | ").slice(0, 500));
  redirect(`/admin/cetak?${q.toString()}`);
}
