import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageAssignment, classAssignments, currentSemester,
  studentClassId, childrenOfClassIds, teacherAssignments,
} from "@/lib/academic";
import AppShell from "@/components/app-shell";
import DangerSubmit from "@/components/danger-submit";
import { createTask, deleteTask, uploadTaskFile, submitTask, gradeSubmission, markCompletedByTeacher, updateTask } from "./actions";

const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
const dtLocal = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

const ERRP: Record<string, string> = {
  lewat: "Batas akhir sudah lewat — tidak bisa mengumpulkan.",
  kunci: "Tenggat lewat — pengumpulan terkunci, tidak bisa revisi.",
  berkas: "Wajib unggah berkas terlebih dahulu.",
  teks: "Jawaban teks wajib diisi.",
  nilai: "Nilai harus angka 0–100.",
};

export default async function TugasPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; t?: string; err?: string; ok?: string; childId?: string }>;
}) {
  const user = await requireUser();
  const { a, t, err, ok, childId: rawChildId } = await searchParams;
  const ctx = await currentSemester();
  const semesterId = ctx?.semester.id;
  const errMsg = err ? ERRP[err] ?? "Terjadi kesalahan." : null;

  /* ════ GURU / ADMIN ════ */
  if (user.role === "GURU" || user.role === "ADMIN") {
    // — layar koreksi satu tugas —
    if (t) {
      const taskId = BigInt(t);
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignment: { include: { subject: true, class: true, teacher: { select: { id: true } } } },
          tp: true,
          files: true,
          submissions: {
            include: { student: { select: { nama: true, username: true } }, files: true, grades: true },
            orderBy: { student: { nama: "asc" } },
          },
        },
      });
      if (!task) notFound();
      if (task.assignment.teacher?.id !== user.id && user.role !== "ADMIN") redirect(`/tugas?a=${task.assignmentId}`);
      const sudah = new Set(task.submissions.map((s) => String(s.studentId)));
      const belum = await prisma.user.findMany({
        where: { classId: task.assignment.classId, role: "SISWA", isActive: true, deletedAt: null },
        select: { id: true, nama: true },
        orderBy: { nama: "asc" },
      });

      return (
        <AppShell user={user} active="/tugas">
          <div className="breadcrumb">
            <a href="/dashboard">Beranda</a>
            <span className="sep">&gt;</span>
            <a href="/tugas">Tugas</a>
            <span className="sep">&gt;</span>
            <a href={`/tugas?a=${task.assignmentId}`}>{task.assignment.class.name} · {task.assignment.subject.name}</a>
            <span className="sep">&gt;</span>
            <span className="current">Koreksi: {task.judul}</span>
          </div>
          <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1>{task.judul}</h1>
              <p className="muted">
                {task.assignment.class.name} · {task.assignment.subject.name} — Tenggat: {fmt(task.dueAt)}
                {task.lateUntil && ` (Toleransi s/d ${fmt(task.lateUntil)})`}
                {task.tp && <> · <span className="pill">{task.tp.code}</span></>}
              </p>
              {errMsg && <p className="error">{errMsg}</p>}
            </div>
            <a className="btn btn-sm" href={`/tugas?a=${task.assignmentId}`}>← Kembali ke Daftar Tugas</a>
          </div>

          <div className="card">
            <div className="card-head"><h2>Instruksi Tugas</h2></div>
            <div className="card-body">
              <p className="prose">{task.instruksi}</p>
              {task.files.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {task.files.map((f) => (
                    <a key={String(f.id)} className="filechip" href={`/api/file/${f.id}?k=t`}>📎 {f.nama}</a>
                  ))}
                </div>
              )}
              <form action={uploadTaskFile} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "stretch", width: "100%" }}>
                <input type="hidden" name="assignmentId" value={String(task.assignmentId)} />
                <input type="hidden" name="taskId" value={String(task.id)} />
                <input className="input" style={{ flex: "1 1 180px", maxWidth: "100%", minHeight: 44, padding: "8px 10px" }} type="file" name="file" required />
                <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>+ Tambah Lampiran</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Pengumpulan Siswa ({task.submissions.length})</h2>
              <span className="badge badge-yellow">Tipe Pengumpulan: {task.tipe}</span>
            </div>
            <div className="card-body">
              {task.submissions.length === 0 && <div className="empty">Belum ada siswa yang mengumpulkan tugas ini.</div>}
              {task.submissions.map((s) => {
                const gr = s.grades[0];
                return (
                  <div className="list-row" key={String(s.id)}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <b>{s.student.nama}</b>
                        <span className={`badge ${s.status === "LATE" ? "badge-red" : "badge-green"}`}>
                          {s.status === "LATE" ? "TERLAMBAT" : "TEPAT WAKTU"}
                        </span>
                        {gr && <span className="badge badge-green">Nilai: {Number(gr.score)}/100</span>}
                      </div>
                      <div className="meta">{fmt(s.submittedAt)}{s.revisiCount > 0 && ` · Revisi ke-${s.revisiCount}`}</div>
                      {s.text && <p className="prose" style={{ marginTop: 8, fontSize: 14 }}>{s.text}</p>}
                      <div style={{ margin: "8px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {s.files.map((f) => (
                          <a key={String(f.id)} className="filechip" href={`/api/file/${f.id}?k=s`} style={{ margin: 0, minHeight: 38, display: "inline-flex", alignItems: "center" }}>📎 {f.nama}</a>
                        ))}
                      </div>
                      <form action={gradeSubmission} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--ink)", width: "100%" }}>
                        <input type="hidden" name="submissionId" value={String(s.id)} />
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: 13 }}>Skor:</span>
                          <input className="input" style={{ width: 84, minHeight: 44, textAlign: "center", fontWeight: 800 }} type="number" name="score" min={0} max={100} step={1}
                            defaultValue={gr ? Number(gr.score).toString() : ""} placeholder="0-100" required />
                        </div>
                        <input className="input" style={{ flex: "1 1 180px", minHeight: 44, fontSize: 13 }} name="feedback" defaultValue={gr?.feedback ?? ""} placeholder="Catatan umpan balik guru (opsional)" />
                        <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{gr ? "Perbarui Nilai" : "Simpan Nilai"}</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {belum.length > 0 && (
            <div className="card">
              <div className="card-head"><h2>Belum Mengumpulkan ({belum.filter((b) => !sudah.has(String(b.id))).length})</h2></div>
              <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {belum.filter((b) => !sudah.has(String(b.id))).map((b) => (
                  <span key={String(b.id)} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px" }}>
                    <span>{b.nama}</span>
                    <form action={markCompletedByTeacher} style={{ display: "inline" }}>
                      <input type="hidden" name="assignmentId" value={String(task.assignmentId)} />
                      <input type="hidden" name="taskId" value={String(task.id)} />
                      <input type="hidden" name="studentId" value={String(b.id)} />
                      <button className="btn btn-sm btn-primary" style={{ minHeight: 32, padding: "2px 10px" }} title="Tandai sudah mengerjakan di buku tulis">
                        ✔ Centang
                      </button>
                    </form>
                  </span>
                ))}
              </div>
            </div>
          )}
        </AppShell>
      );
    }

    // — pilih assignment —
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
        <AppShell user={user} active="/tugas">
          <div className="breadcrumb">
            <a href="/dashboard">Beranda</a>
            <span className="sep">&gt;</span>
            <span className="current">Tugas</span>
          </div>
          <div className="page-head">
            <h1>Kelola Tugas & Penilaian</h1>
            <p>Pilih kelas dan mata pelajaran untuk membuat tugas baru atau memeriksa hasil pengumpulan siswa.</p>
          </div>
          {assigns.length === 0 && <div className="empty">Belum ada kelas mengajar yang terdaftar untuk Anda pada semester ini.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assigns.map((x) => (
              <a className="card" key={String(x.id)} href={`/tugas?a=${x.id}`} style={{ textDecoration: "none", margin: 0 }}>
                <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <h2 style={{ fontSize: 17, marginBottom: 4 }}>{x.class.name} · {x.subject.name}</h2>
                    <span className="muted">Guru Pengampu: {x.teacher?.nama ?? "—"}</span>
                  </div>
                  <span className="btn btn-sm btn-primary btn-block-mobile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                    Kelola Tugas →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </AppShell>
      );
    }

    // — kelola tugas satu assignment —
    const assignmentId = BigInt(a);
    if (!(await canManageAssignment(user, assignmentId))) redirect("/tugas");
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        subject: true, class: true,
        learningTargets: { orderBy: { urutan: "asc" } },
        tasks: {
          where: { deletedAt: null },
          include: { _count: { select: { submissions: true } }, tp: true },
          orderBy: [{ status: "asc" }, { dueAt: "desc" }],
        },
      },
    });
    if (!assignment) notFound();

    return (
      <AppShell user={user} active="/tugas">
        <div className="breadcrumb">
          <a href="/dashboard">Beranda</a>
          <span className="sep">&gt;</span>
          <a href="/tugas">Tugas</a>
          <span className="sep">&gt;</span>
          <span className="current">{assignment.class.name} · {assignment.subject.name}</span>
        </div>
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>Tugas — {assignment.class.name} · {assignment.subject.name}</h1>
            <p className="muted">Buat tugas terstruktur, atur tenggat, dan koreksi pengumpulan siswa.</p>
            {err === "1" && <p className="error">Judul tugas wajib diisi.</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", maxWidth: 360 }}>
            <a className="btn btn-sm btn-block-mobile" href={`/tp/${assignmentId}`} style={{ flex: "1 1 120px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>🎯 Atur TP</a>
            <a className="btn btn-sm btn-block-mobile" href={`/materi?a=${assignmentId}`} style={{ flex: "1 1 120px", display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40 }}>📖 Kelola Materi</a>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>➕ Buat Tugas Baru</h2></div>
          <div className="card-body">
            <form action={createTask}>
              <input type="hidden" name="assignmentId" value={String(assignmentId)} />
              <div className="field">
                <label className="field-label">Judul Tugas</label>
                <input className="input" name="judul" placeholder="mis. Latihan 1 — Perlindungan Data Pribadi" required style={{ minHeight: 44 }} />
              </div>
              <div className="field">
                <label className="field-label">Instruksi &amp; Petunjuk Pengerjaan</label>
                <textarea className="input" name="instruksi" rows={3} placeholder="Jelaskan apa yang harus dikerjakan, format jawaban, dan kriteria penilaian…" />
              </div>
              <div className="form-grid two">
                <div className="field">
                  <label className="field-label">Metode Pengumpulan</label>
                  <select className="input" name="tipe" defaultValue="FILE" style={{ minHeight: 44 }}>
                    <option value="FILE">Unggah Berkas (Foto / PDF / Dokumen)</option>
                    <option value="TEKS">Ketik Jawaban Langsung di Portal</option>
                    <option value="CENTANG">Pengerjaan Buku Tulis Fisik (Centang Guru)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Tujuan Pembelajaran (TP) Terkait</label>
                  <select className="input" name="tpId" defaultValue="" style={{ minHeight: 44 }}>
                    <option value="">— Tanpa TP Terikat —</option>
                    {assignment.learningTargets.map((tp) => (
                      <option key={String(tp.id)} value={String(tp.id)}>{tp.code} — {tp.content.slice(0, 50)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Tenggat Waktu (Deadline)</label>
                  <input className="input" type="datetime-local" name="dueAt" style={{ minHeight: 44 }} />
                </div>
                <div className="field">
                  <label className="field-label">Toleransi Terlambat s/d</label>
                  <input className="input" type="datetime-local" name="lateUntil" style={{ minHeight: 44 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-block-mobile" name="status" value="TERBIT" type="submit" style={{ minHeight: 44, flex: "1 1 auto" }}>Simpan &amp; Terbitkan Tugas</button>
                <button className="btn btn-ghost btn-block-mobile" name="status" value="DRAF" type="submit" style={{ minHeight: 44, flex: "1 1 auto" }}>Simpan Sebagai Draf</button>
              </div>
            </form>
          </div>
        </div>

        {assignment.tasks.map((tk) => (
          <div className="list-row" key={String(tk.id)} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <a href={`/tugas?t=${tk.id}`} style={{ textDecoration: "none" }}><b style={{ fontSize: 16 }}>{tk.judul}</b></a>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  {tk.tp && <span className="pill">{tk.tp.code}</span>}
                  <span className={`badge ${tk.status === "TERBIT" ? "badge-green" : "badge-neutral"}`}>{tk.status}</span>
                </div>
              </div>
              <DangerSubmit
                action={deleteTask}
                hidden={{ id: String(tk.id), assignmentId: String(assignmentId) }}
                confirmText={`Hapus tugas "${tk.judul}" beserta seluruh pengumpulannya?`}
                btnClass="btn btn-danger btn-sm"
              >
                🗑 Hapus
              </DangerSubmit>
            </div>
            <div className="meta">
              📊 {tk._count.submissions} terkumpul · Tenggat: {fmt(tk.dueAt)}
              {tk.lateUntil && ` · Toleransi: ${fmt(tk.lateUntil)}`}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <a className="btn btn-primary btn-block-mobile" href={`/tugas?t=${tk.id}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Koreksi Pengumpulan →</a>
              <details style={{ width: "100%", marginTop: 6 }}>
                <summary className="btn btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", minHeight: 40 }}>✏️ Ubah Tugas</summary>
                <form action={updateTask} style={{ marginTop: 12, maxWidth: 640 }}>
                  <input type="hidden" name="assignmentId" value={String(assignmentId)} />
                  <input type="hidden" name="id" value={String(tk.id)} />
                  <div className="field"><label className="field-label">Judul</label>
                    <input className="input" name="judul" defaultValue={tk.judul} required style={{ minHeight: 44 }} /></div>
                  <div className="field"><label className="field-label">Instruksi</label>
                    <textarea className="input" name="instruksi" rows={3} defaultValue={tk.instruksi} /></div>
                  <div className="form-grid two">
                    <div className="field"><label className="field-label">Tipe</label>
                      <select className="input" name="tipe" defaultValue={tk.tipe} style={{ minHeight: 44 }}>
                        <option value="FILE">FILE</option><option value="TEKS">TEKS</option><option value="CENTANG">CENTANG</option>
                      </select></div>
                    <div className="field"><label className="field-label">TP</label>
                      <select className="input" name="tpId" defaultValue={tk.tpId ? String(tk.tpId) : ""} style={{ minHeight: 44 }}>
                        <option value="">— tanpa TP —</option>
                        {assignment.learningTargets.map((tp) => <option key={String(tp.id)} value={String(tp.id)}>{tp.code}</option>)}
                      </select></div>
                    <div className="field"><label className="field-label">Tenggat</label>
                      <input className="input" type="datetime-local" name="dueAt" defaultValue={dtLocal(tk.dueAt)} style={{ minHeight: 44 }} /></div>
                    <div className="field"><label className="field-label">Toleransi s/d</label>
                      <input className="input" type="datetime-local" name="lateUntil" defaultValue={dtLocal(tk.lateUntil)} style={{ minHeight: 44 }} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-block-mobile" name="status" value="TERBIT" type="submit" style={{ minHeight: 44, flex: "1 1 auto" }}>Simpan &amp; Terbitkan</button>
                    <button className="btn btn-ghost btn-block-mobile" name="status" value="DRAF" type="submit" style={{ minHeight: 44, flex: "1 1 auto" }}>Simpan Draf</button>
                  </div>
                </form>
              </details>
            </div>
          </div>
        ))}
        {assignment.tasks.length === 0 && <div className="empty">Belum ada tugas pembelajaran yang dibuat untuk kelas ini.</div>}
      </AppShell>
    );
  }

  /* ════ SISWA / ORTU (ortu: pilih anak via ?childId=, default anak pertama) ════ */
  let siswaUserId = user.id;
  let anakList: { id: bigint; nama: string }[] = [];
  if (user.role === "ORTU") {
    const links = await prisma.parentLink.findMany({
      where: { parentId: user.id },
      include: { child: { select: { id: true, nama: true } } },
    });
    if (!links.length) {
      return (
        <AppShell user={user} active="/tugas">
          <div className="empty">Belum ada data anak terhubung — hubungi admin.</div>
        </AppShell>
      );
    }
    anakList = links.map((l) => ({ id: l.child.id, nama: l.child.nama }));
    const valid = rawChildId && links.some((l) => String(l.childId) === String(rawChildId));
    siswaUserId = valid ? BigInt(String(rawChildId)) : links[0].childId;
  }
  const clsId = await studentClassId(siswaUserId);
  const assigns = clsId ? await classAssignments([clsId], semesterId) : [];

  if (t) {
    const task = await prisma.task.findUnique({
      where: { id: BigInt(t) },
      include: {
        assignment: { include: { subject: true, class: true } },
        tp: true,
        files: true,
        submissions: { where: { studentId: siswaUserId }, include: { files: true, grades: true } },
      },
    });
    if (!task || task.status !== "TERBIT") notFound();
    // P0: tugas TERBIT kelas lain tidak boleh dibuka via URL langsung.
    if (task.assignment.classId !== clsId) notFound();
    const sub = task.submissions[0];
    const now = new Date();
    const open = !task.dueAt || now <= (task.lateUntil ?? task.dueAt);
    const bolehRevisi = !!sub && !!task.dueAt && now <= task.dueAt;

    return (
      <AppShell user={user} active="/tugas">
        <div className="breadcrumb">
          <a href="/dashboard">Beranda</a>
          <span className="sep">&gt;</span>
          <a href="/tugas">Tugas</a>
          <span className="sep">&gt;</span>
          <span className="current">{task.judul}</span>
        </div>
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>{task.judul}</h1>
            <p className="muted">
              {task.assignment.class.name} · {task.assignment.subject.name} — Tenggat: {fmt(task.dueAt)}
              {task.lateUntil && ` (Toleransi s/d ${fmt(task.lateUntil)})`}
            </p>
            {errMsg && <p className="error">{errMsg}</p>}
            {ok && <p className="badge badge-green">✔ Pengumpulan Tugas Berhasil Disimpan</p>}
          </div>
          <a className="btn btn-sm" href="/tugas">← Kembali ke Daftar</a>
        </div>

        <div className="card">
          <div className="card-head"><h2>Petunjuk &amp; Instruksi Pengerjaan</h2></div>
          <div className="card-body">
            <p className="prose">{task.instruksi}</p>
            {task.files.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {task.files.map((f) => (
                  <a key={String(f.id)} className="filechip" href={`/api/file/${f.id}?k=t`} style={{ margin: 0, minHeight: 38, display: "inline-flex", alignItems: "center" }}>📎 {f.nama}</a>
                ))}
              </div>
            )}
          </div>
        </div>

        {user.role === "SISWA" && (!sub || bolehRevisi) && open ? (
          <div className="card">
            <div className="card-head">
              <h2>{sub ? "✏️ Formulir Revisi Pengumpulan" : "📤 Formulir Pengumpulan Tugas"}</h2>
            </div>
            <div className="card-body">
              <form action={submitTask} encType="multipart/form-data">
                <input type="hidden" name="taskId" value={String(task.id)} />
                {(task.tipe === "TEKS" || task.tipe === "CENTANG") && (
                  <div className="field">
                    <label className="field-label">{task.tipe === "TEKS" ? "Ketik Jawaban Tugas" : "Catatan / Keterangan (Opsional)"}</label>
                    <textarea className="input" name="text" rows={5} defaultValue={sub?.text ?? ""} required={task.tipe === "TEKS"} placeholder="Tuliskan jawaban atau keterangan pengerjaan tugasmu di sini…" />
                  </div>
                )}
                {task.tipe === "FILE" && (
                  <div className="field">
                    <label className="field-label">Unggah Berkas Tugas (Maks 3 berkas: PDF, Foto, Word)</label>
                    <input className="input" style={{ minHeight: 44, padding: "8px 10px" }} type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" required={!sub} />
                    <small className="muted">💡 Tips: Pastikan dokumen terbaca jelas sebelum dikirim.</small>
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 48, fontSize: 15 }}>
                    {sub ? "Simpan Hasil Revisi" : "Kirimkan Jawaban Tugas"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : task.tipe === "CENTANG" && !sub ? (
          <div className="empty">Tugas ini dikerjakan secara langsung di buku tulis atau kelas. Guru akan mencatat dan memberikan centang penilaian.</div>
        ) : (
          <div className="card">
            <div className="card-head">
              <h2>Status Pengumpulan Tugasmu</h2>
              <span className={`badge ${sub?.status === "LATE" ? "badge-red" : "badge-green"}`}>
                {sub?.status === "LATE" ? "TERLAMBAT" : "TEPAT WAKTU"}
              </span>
            </div>
            <div className="card-body">
              <p className="muted">Waktu Kirim: {fmt(sub?.submittedAt ?? null)}{sub && sub.revisiCount > 0 && ` · Telah direvisi ${sub.revisiCount} kali`}</p>
              {sub?.text && <p className="prose" style={{ marginTop: 8 }}>{sub.text}</p>}
              {sub?.files && sub.files.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {sub.files.map((f) => (
                    <a key={String(f.id)} className="filechip" href={`/api/file/${f.id}?k=s`} style={{ margin: 0, minHeight: 38, display: "inline-flex", alignItems: "center" }}>📎 {f.nama}</a>
                  ))}
                </div>
              )}
              {sub?.grades && sub.grades.length > 0 ? (
                <div className="list-row warn" style={{ marginTop: 12 }}>
                  <div>
                    <b>Nilai dari Guru: {Number(sub.grades[0].score)} / 100</b>
                    {sub.grades[0].feedback && <div className="meta" style={{ marginTop: 4 }}>💬 Catatan Guru: {sub.grades[0].feedback}</div>}
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 10 }}>⏳ Nilai belum diberikan oleh guru pengampu.</p>
              )}
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      assignmentId: { in: assigns.map((x) => x.id) },
      status: "TERBIT",
      deletedAt: null,
      OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
    },
    include: {
      assignment: { include: { subject: true, class: true } },
      tp: true,
      submissions: { where: { studentId: siswaUserId }, include: { grades: true } },
    },
    orderBy: { dueAt: "desc" },
  });

  return (
    <AppShell user={user} active="/tugas">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Tugas</span>
      </div>
      <div className="page-head">
        <h1>Daftar Tugas</h1>
        <p>{user.role === "SISWA" ? "Daftar tugas kelas yang harus dikerjakan semester ini." : "Daftar tugas anak Anda semester ini (mode pantau)."}</p>
      </div>
      {user.role === "ORTU" && anakList.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {anakList.map((l) => (
            <a
              key={String(l.id)}
              className={`pill ${String(l.id) === String(siswaUserId) ? "hl" : ""}`}
              href={`/tugas?childId=${l.id}`}
              style={{ padding: "8px 14px", minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              👦 {l.nama}
            </a>
          ))}
        </div>
      )}
      {tasks.length === 0 && <div className="empty">Belum ada tugas pembelajaran untuk kelas ini.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tasks.map((tk) => {
          const sub = tk.submissions[0];
          const g = sub?.grades[0];
          const nilai = g ? Number(g.score) : null;
          const childQ = user.role === "ORTU" ? `&childId=${siswaUserId}` : "";
          return (
            <a className="card" key={String(tk.id)} href={`/tugas?t=${tk.id}${childQ}`} style={{ textDecoration: "none", margin: 0 }}>
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h2 style={{ fontSize: 17, marginBottom: 4 }}>{tk.judul}</h2>
                    <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="badge badge-blue">{tk.assignment.class.name} · {tk.assignment.subject.name}</span>
                      {tk.tp && <span className="pill">{tk.tp.code}</span>}
                      <span>Tenggat: {fmt(tk.dueAt)}</span>
                    </div>
                  </div>
                  <div>
                    {sub ? (
                      nilai !== null ? (
                        <span className="badge badge-green">Nilai: {nilai}</span>
                      ) : (
                        <span className="badge badge-yellow">Terkumpul</span>
                      )
                    ) : (
                      <span className="badge badge-red">Belum Kumpul</span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </AppShell>
  );
}
