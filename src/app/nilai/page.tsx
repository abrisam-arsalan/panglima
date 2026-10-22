import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAssignment, classAssignments, currentSemester, studentClassId, childrenOfClassIds, teacherAssignments } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import DangerSubmit from "@/components/danger-submit";
import {
  setTpScore, toggleFlag, recalculate, setReportScore,
  addAssessment, deleteAssessment, setAssessmentScore,
} from "./actions";

export default async function NilaiPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; err?: string; ok?: string; n?: string; childId?: string }>;
}) {
  const user = await requireUser();
  const { a, err, ok, n, childId: rawChildId } = await searchParams;
  const ctx = await currentSemester();
  const semesterId = ctx?.semester.id;

  /* ═══ SISI PEMBACA: siswa & ortu — ortu pilih anak via ?childId= ═══ */
  if (user.role === "SISWA" || user.role === "ORTU") {
    let siswaUserId = user.id;
    let anakList: { id: bigint; nama: string }[] = [];
    if (user.role === "ORTU") {
      const links = await prisma.parentLink.findMany({
        where: { parentId: user.id },
        include: { child: { select: { id: true, nama: true } } },
      });
      if (!links.length) return <AppShell user={user} active="/nilai"><div className="empty">Belum ada anak terhubung.</div></AppShell>;
      anakList = links.map((l) => ({ id: l.child.id, nama: l.child.nama }));
      const valid = rawChildId && links.some((l) => String(l.childId) === String(rawChildId));
      siswaUserId = valid ? BigInt(String(rawChildId)) : links[0].childId;
    }
    const clsId = await studentClassId(siswaUserId);
    const assigns = clsId ? await classAssignments([clsId], semesterId) : [];
    if (!a) {
      return (
        <AppShell user={user} active="/nilai">
          <div className="breadcrumb">
            <a href="/dashboard">Beranda</a>
            <span className="sep">&gt;</span>
            <span className="current">Nilai &amp; TP</span>
          </div>
          <div className="page-head">
            <h1>Nilai & Ketercapaian TP</h1>
            <p>Pilih mata pelajaran untuk melihat ketercapaian Tujuan Pembelajaran.</p>
          </div>
          {user.role === "ORTU" && anakList.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {anakList.map((l) => (
                <a
                  key={String(l.id)}
                  className={`pill ${String(l.id) === String(siswaUserId) ? "hl" : ""}`}
                  href={`/nilai?childId=${l.id}`}
                  style={{ padding: "8px 14px", minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                >
                  👦 {l.nama}
                </a>
              ))}
            </div>
          )}
          {!assigns.length && <div className="empty">Belum ada data mata pelajaran untuk kelas Anda.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assigns.map((x) => (
              <a className="card" key={String(x.id)} href={`/nilai?a=${x.id}${user.role === "ORTU" ? `&childId=${siswaUserId}` : ""}`} style={{ textDecoration: "none", margin: 0 }}>
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <h2 style={{ fontSize: 17, marginBottom: 4 }}>{x.subject.name}</h2>
                    <span className="muted">Kelas {x.class.name}</span>
                  </div>
                  <span className="btn btn-sm btn-primary btn-block-mobile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                    Lihat Ketercapaian →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </AppShell>
      );
    }
    const assignmentId = BigInt(a);
    const asg = assigns.find((x) => x.id === assignmentId);
    if (!asg) redirect("/nilai");
    const [tps, skor, rapor] = await Promise.all([
      prisma.learningTarget.findMany({ where: { assignmentId }, orderBy: { urutan: "asc" } }),
      prisma.tpScore.findMany({ where: { tp: { assignmentId }, studentId: siswaUserId } }),
      prisma.reportScore.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: siswaUserId } } }),
    ]);
    const m = new Map(skor.map((s) => [String(s.tpId), Number(s.score)]));
    return (
      <AppShell user={user} active="/nilai">
        <div className="breadcrumb">
          <a href="/dashboard">Beranda</a>
          <span className="sep">&gt;</span>
          <a href="/nilai">Nilai</a>
          <span className="sep">&gt;</span>
          <span className="current">{asg.subject.name} ({asg.class.name})</span>
        </div>
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>{asg.subject.name} — {asg.class.name}</h1>
            <p className="muted">Ketercapaian Tujuan Pembelajaran (TP) dan Predikat Nilai Rapor.</p>
          </div>
          <a className="btn btn-sm" href="/nilai">← Kembali ke Daftar Mapel</a>
        </div>

        {rapor && (
          <div className="card" style={{ background: "var(--yellow)" }}>
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Prediksi Nilai Akhir / Rapor</span>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{Number(rapor.score)} / 100</div>
              </div>
              <span className="badge badge-green">TEREKAP OTOMATIS</span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head"><h2>Daftar Ketercapaian TP</h2></div>
          <div className="card-body">
            {tps.map((tp) => (
              <div className="list-row" key={String(tp.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <span className="pill">{tp.code}</span> <b style={{ marginLeft: 6 }}>{tp.content}</b>
                </div>
                <span className={`badge ${m.has(String(tp.id)) ? "badge-green" : "badge-neutral"}`} style={{ fontSize: 14, minHeight: 36, display: "inline-flex", alignItems: "center", padding: "6px 12px" }}>
                  {m.has(String(tp.id)) ? `Skor: ${Math.round(m.get(String(tp.id))!)}` : "Belum Dinilai"}
                </span>
              </div>
            ))}
            {!tps.length && <div className="empty">Guru pengampu belum menyusun TP untuk mata pelajaran ini.</div>}
          </div>
        </div>
      </AppShell>
    );
  }

  /* ═══ SISI PENGELOLA: guru / admin (kepsek baca-saja) ═══ */
  const assigns =
    user.role === "GURU"
      ? await teacherAssignments(user.id, semesterId)
      : await prisma.assignment.findMany({
          where: { ...(semesterId ? { semesterId } : {}) },
          include: { subject: true, class: true, teacher: { select: { nama: true } } },
          orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
        });
  if (!a) {
    return (
      <AppShell user={user} active="/nilai">
        <div className="breadcrumb">
          <a href="/dashboard">Beranda</a>
          <span className="sep">&gt;</span>
          <span className="current">Gradebook</span>
        </div>
        <div className="page-head">
          <h1>Matriks Nilai</h1>
          <p>Pilih kelas dan mata pelajaran untuk melihat ketercapaian Tujuan Pembelajaran (TP) serta rekap nilai persiapan e-Rapor.</p>
        </div>
        {!assigns.length && <div className="empty">Belum ada kelas mengajar yang terdaftar untuk Anda pada semester ini.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {assigns.map((x) => (
            <a className="card" key={String(x.id)} href={`/nilai?a=${x.id}`} style={{ textDecoration: "none", margin: 0 }}>
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <h2 style={{ fontSize: 17, marginBottom: 4 }}>{x.class.name} · {x.subject.name}</h2>
                  <span className="muted">Guru Pengampu: {x.teacher?.nama ?? "—"}</span>
                </div>
                <span className="btn btn-sm btn-primary btn-block-mobile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                  Buka Matriks Nilai →
                </span>
              </div>
            </a>
          ))}
        </div>
      </AppShell>
    );
  }

  const assignmentId = BigInt(a);
  const canEdit = await canManageAssignment(user, assignmentId);
  if (!canEdit && user.role !== "KEPSEK") redirect("/nilai");
  const asg = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      subject: true, class: true,
      learningTargets: { orderBy: { urutan: "asc" } },
      manualAssessments: { include: { grades: true, tp: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!asg) notFound();

  const [students, tpScores, reportScores, flags] = await Promise.all([
    prisma.user.findMany({
      where: { classId: asg.classId, role: "SISWA", isActive: true, deletedAt: null },
      select: { id: true, nama: true, nisn: true },
      orderBy: { nama: "asc" },
    }),
    prisma.tpScore.findMany({ where: { tp: { assignmentId } } }),
    prisma.reportScore.findMany({ where: { assignmentId } }),
    prisma.tpFlag.findMany({ where: { tp: { assignmentId } } }),
  ]);
  const skor = new Map(tpScores.map((s) => [`${s.tpId}|${s.studentId}`, s]));
  const rapor = new Map(reportScores.map((r) => [String(r.studentId), r]));
  const flagSet = new Set(flags.map((f) => `${f.tpId}|${f.studentId}|${f.type}`));
  const asgGrade = new Map(asg.manualAssessments.flatMap((ma) => ma.grades.map((g) => [`${ma.id}|${g.studentId}`, Number(g.score)] as const)));
  const countFlags = (studentId: bigint, type: string) =>
    flags.filter((f) => f.studentId === studentId && f.type === type).length;

  const exportBase = `/api/export/xlsx?subjectId=${asg.subjectId}&tingkat=${asg.class.tingkat}`;

  return (
    <AppShell user={user} active="/nilai">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <a href="/nilai">Gradebook</a>
        <span className="sep">&gt;</span>
        <span className="current">{asg.subject.name} — {asg.class.name}</span>
      </div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>{asg.subject.name} — {asg.class.name}</h1>
          <p className="muted">
            {asg.learningTargets.length} TP Terdaftar · {asg.manualAssessments.length} Asesmen Manual · {students.length} Siswa
            {ok === "rekap" && <> · <span className="badge badge-green">↻ {n} Nilai TP Berhasil Dihitung</span></>}
            {err === "nilai" && <span className="error"> Nilai harus berupa angka 0–100.</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", maxWidth: 460 }}>
          <a className="btn btn-sm btn-primary btn-block-mobile" href={exportBase} style={{ flex: "1 1 120px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>📥 Ekspor Excel ({asg.class.tingkat})</a>
          <a className="btn btn-sm btn-block-mobile" href={`${exportBase}&fmt=csv`} style={{ flex: "1 1 100px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>📥 Ekspor CSV</a>
          <a className="btn btn-sm btn-block-mobile" href={`/tp/${assignmentId}`} style={{ flex: "1 1 90px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>🎯 Atur TP</a>
        </div>
      </div>

      {canEdit && (
        <div className="card">
          <div className="card-head"><h2>⚙️ Rekapitulasi Nilai Otomatis</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <form action={recalculate} style={{ flex: "1 1 auto" }}>
                <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, width: "100%" }}>↻ Hitung Nilai TP &amp; Rapor Otomatis</button>
              </form>
              <form action={recalculate} style={{ flex: "1 1 auto" }}>
                <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                <input type="hidden" name="force" value="1" />
                <button className="btn btn-ghost btn-block-mobile" type="submit" style={{ minHeight: 44, width: "100%" }}>↻ Timpa Koreksi Manual</button>
              </form>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              💡 Agregasi otomatis menghitung rata-rata nilai tugas/asesmen yang terhubung ke TP, kemudian menghasilkan rekomendasi nilai rapor.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2>Matriks Ketercapaian TP &amp; Rapor</h2>
            <span className="muted" style={{ fontSize: 12, display: "block", marginTop: 4 }}>👉 <i>Geser tabel ke samping untuk melihat &amp; mengisi seluruh kolom TP.</i></span>
          </div>
          <span className="pill">✋ TR = Perlu Peningkatan · ⭐ OP = Sangat Tercapai</span>
        </div>
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th>Nama Siswa</th>
                {asg.learningTargets.map((tp) => <th key={String(tp.id)} title={tp.content}>{tp.code}</th>)}
                {asg.manualAssessments.map((ma) => <th key={String(ma.id)}>🖊 {ma.nama}{ma.tp ? ` (${ma.tp.code})` : ""}</th>)}
                <th>NILAI RAPOR</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const r = rapor.get(String(st.id));
                const rv = r ? Number(r.score) : null;
                const kurangValid = rv !== null && rv < 100 && (countFlags(st.id, "PERLU_PENINGKATAN") < 1 || countFlags(st.id, "SANGAT_TERCAPAI") < 1);
                return (
                  <tr key={String(st.id)}>
                    <td style={{ minWidth: 160 }}>
                      <b>{st.nama}</b>
                      <div className="muted" style={{ fontSize: 11 }}>NISN: {st.nisn ?? "—"}</div>
                      {kurangValid && <span className="badge badge-yellow" title="Rapor <100 wajib memiliki minimal 1 TP ✋ dan 1 TP ⭐">⚠ TR/OP</span>}
                    </td>
                    {asg.learningTargets.map((tp) => {
                      const s = skor.get(`${tp.id}|${st.id}`);
                      const isTr = flagSet.has(`${tp.id}|${st.id}|PERLU_PENINGKATAN`);
                      const isOp = flagSet.has(`${tp.id}|${st.id}|SANGAT_TERCAPAI`);
                      return (
                        <td key={String(tp.id)} style={{ textAlign: "center", minWidth: 84 }}>
                          {canEdit ? (
                            <>
                              <form action={setTpScore} className="cellform">
                                <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                                <input type="hidden" name="tpId" value={String(tp.id)} />
                                <input type="hidden" name="studentId" value={String(st.id)} />
                                <input className="input" style={{ width: 68, minWidth: 68, textAlign: "center" }} type="number" min={0} max={100} name="score"
                                  defaultValue={s ? Number(s.score).toString() : ""} placeholder="—" />
                                {s?.source === "MANUAL" && <span title="Koreksi manual" style={{ fontSize: 11 }}>✎</span>}
                              </form>
                              <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: "center" }}>
                                <form action={toggleFlag} className="mini">
                                  <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                                  <input type="hidden" name="tpId" value={String(tp.id)} />
                                  <input type="hidden" name="studentId" value={String(st.id)} />
                                  <input type="hidden" name="type" value="PERLU_PENINGKATAN" />
                                  <button className={`btn btn-sm ${isTr ? "btn-danger" : ""}`} style={{ padding: "4px 8px", minHeight: 34, minWidth: 34, fontSize: 14 }} title="Tandai: Perlu Peningkatan (TR)">✋</button>
                                </form>
                                <form action={toggleFlag} className="mini">
                                  <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                                  <input type="hidden" name="tpId" value={String(tp.id)} />
                                  <input type="hidden" name="studentId" value={String(st.id)} />
                                  <input type="hidden" name="type" value="SANGAT_TERCAPAI" />
                                  <button className={`btn btn-sm ${isOp ? "btn-primary" : ""}`} style={{ padding: "4px 8px", minHeight: 34, minWidth: 34, fontSize: 14 }} title="Tandai: Sangat Tercapai (OP)">⭐</button>
                                </form>
                              </div>
                            </>
                          ) : (
                            s ? Math.round(Number(s.score)) : "—"
                          )}
                        </td>
                      );
                    })}
                    {asg.manualAssessments.map((ma) => {
                      const g = asgGrade.get(`${ma.id}|${st.id}`);
                      return (
                        <td key={String(ma.id)}>
                          {canEdit ? (
                            <form action={setAssessmentScore} className="cellform">
                              <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                              <input type="hidden" name="assessmentId" value={String(ma.id)} />
                              <input type="hidden" name="studentId" value={String(st.id)} />
                              <input className="input" style={{ width: 62, minWidth: 62 }} type="number" min={0} max={100} name="score"
                                defaultValue={g !== undefined ? String(g) : ""} placeholder="—" />
                            </form>
                          ) : (g ?? "—")}
                        </td>
                      );
                    })}
                    <td>
                      <b>{rv !== null ? Math.round(rv) : "—"}</b>
                      {canEdit && (
                        <form action={setReportScore} className="cellform">
                          <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                          <input type="hidden" name="studentId" value={String(st.id)} />
                          <input className="input" style={{ width: 62, minWidth: 62 }} type="number" min={0} max={100} name="score"
                            defaultValue={rv !== null ? String(rv) : ""} placeholder="koreksi" />
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!students.length && <tr><td colSpan={99}><div className="empty">Belum ada siswa terdaftar di kelas ini.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <div className="card">
          <div className="card-head"><h2>➕ Asesmen Manual</h2><span className="pill">UH · Praktik · Nilai CBT</span></div>
          <div className="card-body">
            <form action={addAssessment} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch", width: "100%" }}>
              <input type="hidden" name="assignmentId" value={String(assignmentId)} />
              <input className="input" style={{ flex: "1 1 200px", minHeight: 44 }} name="nama" placeholder="mis. UH Harian 2 / Nilai CBT UTS" required />
              <select className="input" style={{ flex: "1 1 160px", minHeight: 44 }} name="tpId" defaultValue="">
                <option value="">tanpa TP (rapor saja)</option>
                {asg.learningTargets.map((tp) => <option key={String(tp.id)} value={String(tp.id)}>{tp.code}</option>)}
              </select>
              <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>+ Tambah Kolom</button>
            </form>
            {asg.manualAssessments.map((ma) => (
              <div key={String(ma.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "6px 0", borderBottom: "1px dashed var(--ink)" }}>
                <span className="badge badge-blue">🖊 {ma.nama}{ma.tp ? ` → ${ma.tp.code}` : ""}</span>
                <DangerSubmit action={deleteAssessment} hidden={{ id: String(ma.id) }}
                  confirmText={`Hapus asesmen "${ma.nama}" beserta nilainya?`} btnClass="btn btn-danger btn-sm">🗑 Hapus</DangerSubmit>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="muted">
        Urutan baris <b>alfabetis</b> = urutan template kementerian → blok kolom TP tinggal disalin per kolom.
        Belum kenal aturan pembulatan? Ikuti 0–100 dulu; cek Panduan PPA saat penyesuaian final.
      </p>
    </AppShell>
  );
}
