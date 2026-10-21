import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { DAYS } from "@/lib/notify";
import { openSession, saveAttendance } from "./actions";
import MarkAll from "./mark-all";
import { AttendanceStatus } from "@prisma/client";

export default async function PresensiPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; ok?: string }>;
}) {
  const user = await requireRole(["GURU", "ADMIN"]);
  const { session: sessionIdStr, ok } = await searchParams;

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

    return (
      <AppShell user={user} active="/presensi">
        <div className="page-head">
          <h1>Presensi Kelas: {session.schedule.assignment.class.name}</h1>
          <p>
            {session.schedule.assignment.subject.name} · {dateFormatted} · Jam {session.schedule.startTime}–{session.schedule.endTime} ·{" "}
            <span className={`badge ${session.status === "SELESAI" ? "badge-green" : "badge-yellow"}`}>
              {session.status}
            </span>
          </p>
          {ok && <p className="badge badge-green" style={{ marginTop: 8 }}>✅ Presensi berhasil disimpan!</p>}
        </div>

        <form action={saveAttendance} id="form-presensi">
          <input type="hidden" name="sessionId" value={String(session.id)} />

          <div className="card">
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2>Daftar Siswa ({session.records.length})</h2>
              <span className="muted">Default: HADIR. Klik opsi untuk siswa yang berhalangan.</span>
            </div>
            <MarkAll formId="form-presensi" />
            <div className="card-body">
              {session.records.length === 0 && (
                <div className="empty">Belum ada siswa terdaftar di kelas ini.</div>
              )}
              {session.records.map((r, i) => (
                <div
                  className="list-row"
                  key={String(r.id)}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "space-between",
                    flexDirection: "column",
                    gap: 10,
                    padding: "12px",
                    borderBottom: "2px solid var(--border)",
                  }}
                >
                  <div style={{ width: "100%" }}>
                    <span style={{ fontWeight: 900, marginRight: 8, fontSize: 16 }}>{i + 1}.</span>
                    <b style={{ fontSize: 15 }}>{r.student.nama}</b>
                    <div className="meta" style={{ marginTop: 2 }}>NISN: {r.student.nisn ?? "—"}</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                    <div className="attendance-options">
                      {(["HADIR", "SAKIT", "IZIN", "ALPHA"] as AttendanceStatus[]).map((st) => (
                        <label
                          key={st}
                          className="status-pill"
                        >
                          <input
                            type="radio"
                            name={`status_${r.studentId}`}
                            value={st}
                            defaultChecked={r.status === st}
                            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                          />
                          {st === "HADIR" && "✅ Hadir"}
                          {st === "SAKIT" && "🤒 Sakit"}
                          {st === "IZIN" && "📄 Izin"}
                          {st === "ALPHA" && "❌ Alpa"}
                        </label>
                      ))}
                    </div>

                    <input
                      className="input"
                      style={{ width: "100%", fontSize: 13, minHeight: 44 }}
                      type="text"
                      name={`ket_${r.studentId}`}
                      defaultValue={r.keterangan}
                      placeholder="Keterangan / alasan izin / sakit (opsional)..."
                    />
                  </div>
                </div>
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
                  placeholder="Ringkasan materi atau bab yang diajarkan pada pertemuan ini..."
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
                  placeholder="Catatan perilaku, PR, atau hal khusus dalam kelas..."
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button className="btn btn-green btn-block-mobile" type="submit" name="finish" value="1" style={{ minHeight: 48, fontSize: 15, flex: "1 1 auto" }}>
              ✅ Simpan & Tandai Selesai
            </button>
            <button className="btn btn-primary btn-block-mobile" type="submit" name="finish" value="0" style={{ minHeight: 48, fontSize: 15, flex: "1 1 auto" }}>
              💾 Simpan Draf
            </button>
            <a className="btn btn-ghost btn-block-mobile" href="/presensi" style={{ minHeight: 48, fontSize: 15, flex: "1 1 auto", textAlign: "center" }}>
              ← Kembali
            </a>
          </div>
        </form>
      </AppShell>
    );
  }

  // Tampilan Beranda Presensi: Jadwal Hari Ini & Jadwal Mengajar
  const teacherWhere = user.role === "GURU" ? { teacherId: user.id } : {};
  const schedules = await prisma.schedule.findMany({
    where: { assignment: teacherWhere },
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
      <div className="page-head">
        <h1>Presensi & Jurnal Mengajar ✅</h1>
        <p>Buka absensi harian dan catat jurnal materi kelas sesuai jadwal mengajar Anda.</p>
      </div>

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
                    ⏰ {s.startTime} – {s.endTime} {s.room ? `· Ruang: ${s.room}` : ""} · Guru: {s.assignment.teacher?.nama}
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
                  {s.room ? `Ruang ${s.room}` : "Kelas reguler"}
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
