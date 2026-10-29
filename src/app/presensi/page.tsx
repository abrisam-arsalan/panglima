import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import PageHead from "@/components/page-head";
import { GlyphPresensi } from "@/components/glyph";
import { DAYS, roomLabel } from "@/lib/notify";
import { openSession, reopenSession, saveAttendance } from "./actions";
import MarkAll from "./mark-all";
import AttendanceRow from "./attendance-row";
import SaveButtons from "./save-buttons";

export default async function PresensiPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; ok?: string; err?: string }>;
}) {
  const user = await requireRole(["GURU", "ADMIN"]);
  const { session: sessionIdStr, ok, err } = await searchParams;

  const today = new Date();
  const todayDay = today.getDay(); // 0=Minggu, 1=Senin..
  const todayStr = today.toISOString().slice(0, 10);

  // Jika sedang membuka sesi spesifik
  if (sessionIdStr) {
    const sessionId = BigInt(sessionIdStr);
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        schedule: {
          include: {
            assignment: {
              include: { class: true, subject: true, teacher: true },
            },
          },
        },
        records: {
          include: { student: true },
          orderBy: { student: { nama: "asc" } },
        },
      },
    });

    if (!session) notFound();
    if (user.role === "GURU" && session.schedule.assignment.teacherId !== user.id) {
      redirect("/presensi");
    }

    const dateFormatted = new Date(session.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Sesi SELESAI = terkunci: guru hanya melihat, admin bisa buka kembali.
    // Tombol simpan sengaja TIDAK dirender agar tak ada submit yang mentok 500.
    const locked = session.status === "SELESAI";
    const canEdit = !locked || user.role === "ADMIN";

    return (
      <AppShell user={user} active="/presensi">
        <div className="page-head">
          <h1>Presensi Kelas: {session.schedule.assignment.class.name}</h1>
          <p>
            {session.schedule.assignment.subject.name} · {dateFormatted} · Jam {session.schedule.startTime}–{session.schedule.endTime} ·{" "}
            <span className={`badge ${locked ? "badge-green" : "badge-yellow"}`}>
              {locked ? "🔒 TERKUNCI" : session.status}
            </span>
          </p>
          {ok && <p className="badge badge-green" style={{ marginTop: 8 }}>Tersimpan.</p>}
          {err && <p className="badge badge-red" style={{ marginTop: 8 }}>✕ {decodeURIComponent(err)}</p>}
        </div>

        {locked && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            🔒 Sesi ini sudah dikunci{user.role === "ADMIN" ? " — Anda admin sehingga tetap bisa mengubah / membuka kembali." : " — hubungi admin bila perlu koreksi."}
          </div>
        )}

        {locked && user.role === "ADMIN" && (
          <form action={reopenSession} style={{ marginBottom: 16 }}>
            <input type="hidden" name="sessionId" value={String(session.id)} />
            <button className="btn btn-yellow btn-block-mobile" type="submit" style={{ minHeight: 44, fontSize: 14, width: "100%" }}>
              🔓 Buka Kembali Sesi (Reset Kunci)
            </button>
          </form>
        )}

        {canEdit ? (
        <form action={saveAttendance} id="form-presensi">
          <input type="hidden" name="sessionId" value={String(session.id)} />

          <div className="card">
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2>Daftar Siswa ({session.records.length})</h2>
              <span className="muted">Default: HADIR. Klik opsi untuk siswa yang berhalangan.</span>
            </div>
            <MarkAll formId="form-presensi" />
            <div className="card-body" style={{ padding: 0 }}>
              {session.records.length === 0 && (
                <div className="empty" style={{ padding: 16 }}>Belum ada siswa terdaftar di kelas ini.</div>
              )}
              {session.records.map((r, i) => (
                <AttendanceRow
                  key={String(r.id)}
                  no={i + 1}
                  nama={r.student.nama}
                  studentId={String(r.studentId)}
                  defaultStatus={r.status}
                  defaultKet={r.keterangan}
                />
              ))}
            </div>
          </div>

          <div className="form-grid two" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-head">
                <h2>Materi Hari Ini</h2>
              </div>
              <div className="card-body">
                <textarea
                  className="input"
                  name="materi"
                  rows={4}
                  defaultValue={session.materi}
                  placeholder="Materi/bab pertemuan ini…"
                />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Catatan Kelas</h2>
              </div>
              <div className="card-body">
                <textarea
                  className="input"
                  name="catatanKelas"
                  rows={4}
                  defaultValue={session.catatanKelas}
                  placeholder="Catatan kelas, PR, hal khusus…"
                />
              </div>
            </div>
          </div>

          <SaveButtons />
          <div style={{ marginTop: 10 }}>
            <a className="btn btn-ghost btn-block-mobile" href="/presensi" style={{ minHeight: 44, fontSize: 14, width: "100%", textAlign: "center" }}>
              ← Kembali
            </a>
          </div>
        </form>
        ) : (
        <div className="card">
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2>Daftar Siswa ({session.records.length})</h2>
            <span className="pill">Mode lihat saja</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {session.records.length === 0 && (
              <div className="empty" style={{ padding: 16 }}>Belum ada siswa terdaftar di kelas ini.</div>
            )}
            {session.records.map((r, i) => (
              <div key={String(r.id)} className="att-row">
                <div className="att-name" title={r.student.nama}>
                  <span className="no">{i + 1}.</span>
                  {r.student.nama}
                </div>
                <span className={`badge ${r.status === "HADIR" ? "badge-green" : r.status === "ALPHA" ? "badge-red" : "badge-yellow"}`}>
                  {r.status === "HADIR" ? "✔️ H" : r.status === "SAKIT" ? "🤒 S" : r.status === "IZIN" ? "📄 I" : "❌ A"}
                </span>
              </div>
            ))}
            {(session.materi || session.catatanKelas) && (
              <div style={{ padding: "10px 14px", borderTop: "2px solid var(--ink)" }}>
                {session.materi && <div style={{ fontSize: 13 }}>📖 <b>Materi:</b> {session.materi}</div>}
                {session.catatanKelas && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>📌 <b>Catatan:</b> {session.catatanKelas}</div>}
              </div>
            )}
          </div>
          <div style={{ padding: 12 }}>
            <a className="btn btn-ghost btn-block-mobile" href="/presensi" style={{ minHeight: 44, fontSize: 14, width: "100%", textAlign: "center" }}>
              ← Kembali
            </a>
          </div>
        </div>
        )}
      </AppShell>
    );
  }

  // Tampilan Beranda Presensi: Jadwal Hari Ini & Jadwal Mengajar.
  // Hanya jadwal AKTIF — nonaktif disembunyikan tapi sesinya tetap di rekap.
  const teacherWhere = user.role === "GURU" ? { teacherId: user.id } : {};
  const schedules = await prisma.schedule.findMany({
    where: { isActive: true, assignment: teacherWhere },
    include: {
      assignment: {
        include: { class: true, subject: true, teacher: true },
      },
      classSessions: {
        where: { date: new Date(`${todayStr}T00:00:00.000Z`) },
      },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const todaySchedules = schedules.filter((s) => s.day === todayDay);

  return (
    <AppShell user={user} active="/presensi">
      <PageHead
        title="Presensi & Jurnal Mengajar"
        sub="Buka absensi harian dan catat jurnal materi kelas sesuai jadwal mengajar Anda."
        glyph={<GlyphPresensi />}
      />

      <div className="card">
        <div className="card-head">
          <h2>Jadwal Hari Ini ({DAYS[todayDay]})</h2>
          <span className="pill">{todayStr}</span>
        </div>
        <div className="card-body">
          {todaySchedules.length === 0 && (
            <div className="empty">Tidak ada jadwal mengajar pada hari ini ({DAYS[todayDay]}).</div>
          )}
          {todaySchedules.map((s) => {
            const activeSession = s.classSessions[0];
            return (
              <div
                className="list-row"
                key={String(s.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {s.assignment.class.name} · {s.assignment.subject.name}
                  </h3>
                  <div className="meta">
                    ⏰ {s.startTime} – {s.endTime} {roomLabel(s.room) ? `· ${roomLabel(s.room)}` : ""} · Guru: {s.assignment.teacher?.nama}
                  </div>
                </div>

                <div style={{ width: "100%", maxWidth: "fit-content" }} className="btn-block-mobile">
                  {activeSession ? (
                    <a className="btn btn-primary btn-sm btn-block-mobile" href={`/presensi?session=${activeSession.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      📝 Lanjut Presensi ({activeSession.status})
                    </a>
                  ) : (
                    <form action={openSession} style={{ width: "100%" }}>
                      <input type="hidden" name="scheduleId" value={String(s.id)} />
                      <input type="hidden" name="date" value={todayStr} />
                      <button className="btn btn-green btn-sm btn-block-mobile" type="submit" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        ▶️ Buka Presensi
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">
          <h2>Semua Jadwal Mengajar Mingguan</h2>
        </div>
        <div className="card-body">
          {schedules.length === 0 && <div className="empty">Belum ada jadwal mengajar yang diatur.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {schedules.map((s) => (
              <div
                key={String(s.id)}
                className="card"
                style={{ margin: 0, padding: 14, background: s.day === todayDay ? "var(--bg-accent, #FFF9DB)" : undefined }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{DAYS[s.day]}</b>
                  <span className="pill" style={{ fontSize: 11 }}>{s.startTime}–{s.endTime}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 6 }}>
                  {s.assignment.class.name} — {s.assignment.subject.name}
                </div>
                <div className="meta" style={{ marginTop: 4 }}>
                  {roomLabel(s.room) || "Kelas reguler"}
                </div>
                <form action={openSession} style={{ marginTop: 12 }}>
                  <input type="hidden" name="scheduleId" value={String(s.id)} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="date" name="date" defaultValue={todayStr} className="input" style={{ flex: "1 1 130px", minHeight: 44, fontSize: 13, padding: "6px 8px" }} required />
                    <button className="btn btn-sm btn-primary" type="submit" style={{ whiteSpace: "nowrap", flex: "1 1 auto", minHeight: 44 }}>
                      Buka →
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
