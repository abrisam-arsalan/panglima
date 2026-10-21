import { prisma } from "@/lib/prisma";

/**
 * Sumber AUTO nilai TP per siswa:
 *  - rata-rata Grade tugas yang tugasnya merujuk TP tsb (submission.task.tpId)
 *  - + rata-rata Grade asesmen manual yang dikaitkan ke TP tsb
 * Nilai MANUAL (tp_scores, source=MANUAL) selalu menang smp di-recalculate.
 */
export async function computeAutoTpScores(assignmentId: bigint) {
  const [taskGrades, manualGrades, tps] = await Promise.all([
    prisma.grade.findMany({
      where: { target: "TUGAS", submission: { task: { assignmentId, tpId: { not: null } } } },
      include: { submission: { select: { taskId: true, studentId: true } } },
    }),
    prisma.grade.findMany({
      where: { target: "MANUAL", manualAssessment: { assignmentId, tpId: { not: null } } },
      include: { manualAssessment: { select: { tpId: true } } },
    }),
    prisma.learningTarget.findMany({ where: { assignmentId }, select: { id: true } }),
  ]);

  const buckets = new Map<string, { sum: number; n: number }>(); // `${tpId}|${studentId}`
  const add = (tpId: bigint, studentId: bigint, score: number) => {
    const k = `${tpId}|${studentId}`;
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += score; b.n += 1;
    buckets.set(k, b);
  };
  const tpOfTask = new Map<string, bigint>();
  const tasks = await prisma.task.findMany({
    where: { id: { in: [...new Set(taskGrades.flatMap((g) => (g.submission ? [g.submission.taskId] : [])))] } },
    select: { id: true, tpId: true },
  });
  for (const t of tasks) if (t.tpId) tpOfTask.set(String(t.id), t.tpId);

  for (const g of taskGrades) {
    if (!g.submission) continue;
    const tpId = tpOfTask.get(String(g.submission.taskId));
    if (tpId) add(tpId, g.submission.studentId, Number(g.score));
  }
  for (const g of manualGrades) {
    const tpId = g.manualAssessment?.tpId;
    if (tpId) add(tpId, g.studentId, Number(g.score));
  }
  return { buckets, tpIds: tps.map((t) => t.id) };
}

/**
 * Rapor = rata-rata skor TP siswa (MANUAL/AUTO tergabung); null bila belum ada.
 * Baris isManual=true (koreksi guru via setReportScore) TIDAK disentuh —
 * koreksi adalah keputusan, bukan hitungan yang boleh dihitung ulang.
 */
export async function recomputeReports(assignmentId: bigint) {
  const [tpScores, students, manualLocks] = await Promise.all([
    prisma.tpScore.findMany({ where: { tp: { assignmentId } } }),
    prisma.user.findMany({
      where: { classRef: { assignments: { some: { id: assignmentId } } }, role: "SISWA", deletedAt: null, isActive: true },
      select: { id: true },
    }),
    prisma.reportScore.findMany({
      where: { assignmentId, isManual: true },
      select: { studentId: true },
    }),
  ]);
  const locked = new Set(manualLocks.map((r) => String(r.studentId)));
  const perSiswa = new Map<string, number[]>();
  for (const s of tpScores) {
    const arr = perSiswa.get(String(s.studentId)) ?? [];
    arr.push(Number(s.score));
    perSiswa.set(String(s.studentId), arr);
  }
  let n = 0;
  for (const st of students) {
    if (locked.has(String(st.id))) continue; // koreksi guru menang
    const arr = perSiswa.get(String(st.id));
    if (arr && arr.length) {
      const avg = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
      await prisma.reportScore.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: st.id } },
        create: { assignmentId, studentId: st.id, score: avg },
        update: { score: avg },
      });
      n++;
    }
  }
  return n;
}

/** Sinkronkan AUTO tp_scores ke nilai hitung-ulang; MANUAL dibiarkan (kecuali dipaksa). */
export async function syncAutoTpScores(assignmentId: bigint, force = false) {
  const { buckets } = await computeAutoTpScores(assignmentId);
  let n = 0;
  for (const [key, b] of buckets) {
    const [tpId, studentId] = key.split("|").map(BigInt);
    const avg = Math.round((b.sum / b.n) * 100) / 100;
    const existing = await prisma.tpScore.findUnique({ where: { tpId_studentId: { tpId, studentId } } });
    if (existing && existing.source === "MANUAL" && !force) continue;
    await prisma.tpScore.upsert({
      where: { tpId_studentId: { tpId, studentId } },
      create: { tpId, studentId, score: avg, source: "AUTO" },
      update: { score: avg, source: "AUTO" },
    });
    n++;
  }
  return n;
}
