import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import DangerSubmit from "@/components/danger-submit";
import { createAssignment, deleteAssignment, setHomeroom, addSubject } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPenugasanPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const me = await requireRole(["ADMIN"]);
  const { err, msg } = await searchParams;
  const ctx = await currentSemester();

  const [assignments, teachers, subjects, classes] = await Promise.all([
    ctx
      ? prisma.assignment.findMany({
          where: { semesterId: ctx.semester.id },
          include: {
            subject: true,
            class: true,
            teacher: { select: { id: true, nama: true } },
            _count: { select: { learningTargets: true, materials: true, tasks: true, schedules: true } },
          },
          orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { role: "GURU", isActive: true, deletedAt: null },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    ctx
      ? prisma.class.findMany({
          where: { academicYearId: ctx.year.id },
          orderBy: [{ tingkat: "asc" }, { name: "asc" }],
          include: { homeroom: { select: { id: true, nama: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell user={me} active="/admin/penugasan">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">PENUGASAN</span>
      </nav>

      <div className="page-head">
        <h1>Penugasan Mengajar &amp; Pembagian Kelas 📋</h1>
        <p>
          Atur penugasan guru per mata pelajaran dan rombongan belajar, penentuan wali kelas, serta kurikulum mata pelajaran.
          {ctx ? ` (Semester Aktif: ${ctx.year.name} / ${ctx.semester.name})` : " (Tahun ajaran aktif belum ditentukan)"}
        </p>
      </div>

      {msg && <div className="alert alert-success">✓ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">✕ {decodeURIComponent(err)}</div>}

      {/* STATS OVERVIEW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ margin: 0, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>TOTAL PENUGASAN</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary, #1e3a8a)" }}>{assignments.length}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>GURU AKTIF</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary, #1e3a8a)" }}>{teachers.length}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>MATA PELAJARAN</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary, #1e3a8a)" }}>{subjects.length}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>TOTAL ROMBEL</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary, #1e3a8a)" }}>{classes.length}</div>
        </div>
      </div>

      {/* FORM PENUGASAN BARU */}
      {ctx ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <h2>➕ Buat Penugasan Guru Baru</h2>
          </div>
          <div className="card-body">
            <form action={createAssignment} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) 120px", gap: 12, alignItems: "end" }}>
              <div className="field" style={{ margin: 0 }}>
                <label className="field-label">Guru Pengampu</label>
                <select className="input" name="teacherUserId" required defaultValue="" style={{ minHeight: 40 }}>
                  <option value="" disabled>— Pilih Guru —</option>
                  {teachers.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {t.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label className="field-label">Mata Pelajaran</label>
                <select className="input" name="subjectId" required defaultValue="" style={{ minHeight: 40 }}>
                  <option value="" disabled>— Pilih Mata Pelajaran —</option>
                  {subjects.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label className="field-label">Rombel (Kelas)</label>
                <select className="input" name="classId" required defaultValue="" style={{ minHeight: 40 }}>
                  <option value="" disabled>— Pilih Rombel —</option>
                  {classes.map((k) => (
                    <option key={String(k.id)} value={String(k.id)}>
                      Kelas {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn btn-primary" type="submit" style={{ minHeight: 40 }}>
                Tugaskan
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="alert alert-yellow" style={{ marginBottom: 20 }}>
          ⚠️ Tahun ajaran dan semester aktif belum ditentukan di sistem. Mohon atur semester aktif terlebih dahulu.
        </div>
      )}

      {/* TABEL PENUGASAN AKTIF */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Daftar Penugasan Aktif ({assignments.length})</h2>
          <span className="muted" style={{ fontSize: 13 }}>Semester ini</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Rombel</th>
                <th>Mata Pelajaran</th>
                <th>Guru Pengampu</th>
                <th style={{ width: 170 }}>Konten Terbuat</th>
                <th style={{ width: 200, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={String(a.id)}>
                  <td>
                    <span className="badge badge-blue"><b>{a.class.name}</b></span>
                  </td>
                  <td>
                    <b>{a.subject.name}</b>
                    <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>({a.subject.code})</span>
                  </td>
                  <td>{a.teacher?.nama ?? "—"}</td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    🎯 {a._count.learningTargets} TP · 📖 {a._count.materials} Materi · 📝 {a._count.tasks} Tugas · ⏰ {a._count.schedules} Jam
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <Link className="pill" href={`/jadwal?a=${a.id}`}>
                        Jadwal
                      </Link>
                      <Link className="pill" href={`/nilai?a=${a.id}`}>
                        Nilai
                      </Link>
                      <Link className="pill" href={`/tp/${a.id}`}>
                        TP
                      </Link>
                      <DangerSubmit
                        action={deleteAssignment}
                        hidden={{ id: String(a.id) }}
                        confirmText={`Hapus penugasan ${a.class.name} - ${a.subject.name} (${a.teacher?.nama})?`}
                        btnClass="btn btn-sm"
                      >
                        ✕
                      </DangerSubmit>
                    </div>
                  </td>
                </tr>
              ))}
              {!assignments.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">Belum ada penugasan guru untuk semester aktif ini.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WALI KELAS & KELOLA MAPEL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, marginBottom: 20 }}>
        {/* KELOLA WALI KELAS */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>Penetapan Wali Kelas 👨‍🏫</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Rombel</th>
                  <th>Wali Kelas Saat Ini</th>
                  <th style={{ width: 170 }}>Ubah Wali</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((k) => (
                  <tr key={String(k.id)}>
                    <td><b>{k.name}</b></td>
                    <td>{k.homeroom?.nama ? <span className="badge badge-green">{k.homeroom.nama}</span> : <span className="muted">— belum ada —</span>}</td>
                    <td>
                      <form action={setHomeroom} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="classId" value={String(k.id)} />
                        <select className="input" style={{ minHeight: 34, fontSize: 13 }} name="homeroomUserId" defaultValue={k.homeroom?.id ? String(k.homeroom.id) : ""}>
                          <option value="">— Kosongkan —</option>
                          {teachers.map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {t.nama}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-primary" type="submit">
                          Simpan
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!classes.length && (
                  <tr>
                    <td colSpan={3} className="muted" style={{ textAlign: "center", padding: 16 }}>
                      Belum ada data rombel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KELOLA MATA PELAJARAN */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>➕ Mata Pelajaran Kurikulum</h2>
          </div>
          <div className="card-body">
            <form action={addSubject} style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px", gap: 8, marginBottom: 16 }}>
              <input className="input" name="name" placeholder="Nama Mapel (mis. Informatika)" required maxLength={80} style={{ minHeight: 38 }} />
              <input className="input" name="code" placeholder="Kode (INF)" maxLength={16} style={{ minHeight: 38 }} />
              <button className="btn btn-sm btn-primary" type="submit" style={{ minHeight: 38 }}>
                + Tambah
              </button>
            </form>

            <div className="field-label" style={{ marginBottom: 6 }}>Daftar Mata Pelajaran Terdaftar ({subjects.length}):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {subjects.map((s) => (
                <span key={String(s.id)} className="pill" style={{ fontSize: 13, padding: "4px 10px" }}>
                  <b>{s.name}</b> <small className="muted">({s.code})</small>
                </span>
              ))}
              {!subjects.length && <span className="muted">Belum ada mata pelajaran.</span>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
