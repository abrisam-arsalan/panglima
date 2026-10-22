import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { getCbtExamsForUser } from "@/lib/cbt-sync";
import { broadcastExamsAction, launchCbt, syncStudentsAction } from "./actions";

export default async function UjianPortalPage() {
  const user = await requireUser();
  // Wajib via env — tanpa fallback localhost diam-diam di produksi.
  const cbtBaseUrl = process.env.CBT_BASE_URL;
  if (!cbtBaseUrl) {
    throw new Error("CBT_BASE_URL belum diset di .env");
  }

  // CATATAN: broadcast ujian baru TIDAK lagi otomatis tiap render
  // (berat + side-effect di render + risiko spam pengumuman).
  // Admin/Guru memicunya manual via tombol "Siarkan Notifikasi Ujian",
  // atau cron memanggil broadcastExamsAction.

  // Ambil daftar ujian yang relevan bagi user
  const exams = await getCbtExamsForUser(user);

  const isStudent = user.role === "SISWA" || user.role === "ORTU";
  const isTeacher = user.role === "GURU";
  const isAdmin = user.role === "ADMIN";

  // ORTU: daftar anak untuk kredensial + handoff per anak.
  const anakOrtu = user.role === "ORTU"
    ? await prisma.parentLink.findMany({
        where: { parentId: user.id },
        include: { child: { select: { id: true, nama: true, nisn: true, username: true } } },
      }).catch(() => [])
    : [];

  return (
    <AppShell user={user} active="/ujian">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Ujian CBT</span>
      </div>

      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Ujian CBT</h1>
          <p>Pelaksanaan asesmen formatif, sumatif, dan penyusunan bank soal Computer Based Test.</p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={broadcastExamsAction}>
              <button className="btn btn-sm btn-yellow btn-block-mobile" type="submit" title="Siarkan ujian ke notifikasi dan pengumuman siswa">
                📢 Siarkan Notifikasi Ujian
              </button>
            </form>
            <form action={syncStudentsAction}>
              <button className="btn btn-sm btn-primary btn-block-mobile" type="submit" title="Sinkronkan data siswa aktif ke database CBT">
                👥 Sync Siswa ke CBT
              </button>
            </form>
          </div>
        )}
      </div>

      {/* TAMPILAN SISWA & ORANG TUA */}
      {isStudent && (
        <>
          <div className="card">
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2>Daftar Jadwal Ujian Tersedia 🎯</h2>
              <span className="badge badge-green">SERVER CBT AKTIF</span>
            </div>
            <div className="card-body">
              {exams.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {exams.map((ex) => (
                    <div
                      key={String(ex.id)}
                      className="list-row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: "14px 16px",
                        borderLeft: "6px solid var(--teal)",
                        background: "rgba(13, 148, 136, 0.04)",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ flex: "1 1 280px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                          <b style={{ fontSize: 16 }}>{ex.title}</b>
                          <span className="badge badge-yellow">⏱️ {ex.duration_minutes} Menit</span>
                          {ex.class_name && <span className="pill">Kelas {ex.class_name}</span>}
                          {ex.grade && <span className="pill">Jenjang Kelas {ex.grade}</span>}
                          <span className="badge badge-green">SIAP DIKERJAKAN</span>
                        </div>
                        {ex.description && <p className="muted" style={{ fontSize: 14, margin: "4px 0" }}>{ex.description}</p>}
                        <div className="meta" style={{ marginTop: 6, fontSize: 13 }}>
                          📅 Pelaksanaan: {ex.start_at ? new Date(ex.start_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Jadwal Aktif"}
                        </div>
                      </div>

                      <div className="w-full-mobile" style={{ display: "flex", justifyContent: "flex-end" }}>
                        <form action={launchCbt}>
                          <button
                            className="btn btn-primary btn-block-mobile"
                            type="submit"
                            style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          >
                            🚀 Masuk &amp; Kerjakan Ujian
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ padding: "24px 16px" }}>
                  Belum ada jadwal ujian aktif untuk kelasmu saat ini. Silakan pantau pengumuman warta atau tunggu arahan dari guru pengampu.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ maxWidth: 720 }}>
            <div className="card-head">
              <h2>Panduan Akses &amp; Akun Login Ujian Siswa 🔑</h2>
            </div>
            <div className="card-body">
              <p style={{ lineHeight: 1.6, fontSize: 15, marginBottom: 16 }}>
                Ujian dilaksanakan di sistem CBT mandiri agar koneksi tetap stabil selama pengerjaan soal.
                {process.env.CBT_SSO_ENABLED === "1" ? (
                  <>Tekan tombol di bawah — portal menerbitkan kode sekali-pakai (60 detik) agar Anda
                  <b> tidak perlu mengetik ulang</b> username &amp; PIN. Bila kode kedaluwarsa / portal
                  tidak terjangkau, login manual dengan kredensial berikut tetap berfungsi:</>
                ) : (
                  <>Tekan tombol di bawah untuk membuka halaman ujian, lalu <b>login ulang</b> dengan
                  kredensial berikut (mode handoff aktif setelah CBT di-update — lihat P7):</>
                )}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {user.role === "ORTU" ? (
                  anakOrtu.map((l) => (
                    <div key={String(l.childId)} className="list-row" style={{ margin: 0, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span>👦 <b>{l.child.nama}</b> — <code>{l.child.nisn || l.child.username}</code></span>
                      <form action={launchCbt}>
                        <input type="hidden" name="childId" value={String(l.childId)} />
                        <button className="btn btn-sm btn-primary" type="submit" style={{ minHeight: 44 }}>
                          🚀 Bukakan Ujian
                        </button>
                      </form>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="list-row" style={{ margin: 0, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span>👤 <b>Username Login Siswa:</b></span>
                      <span className="pill"><code>{user.nisn || user.username}</code> (NISN Anda)</span>
                    </div>
                    <div className="list-row" style={{ margin: 0, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span>🔑 <b>Password / PIN Siswa:</b></span>
                      <span className="meta">Gunakan PIN yang sama dengan portal (minta ke wali kelas bila lupa)</span>
                    </div>
                  </>
                )}
                <div className="list-row" style={{ margin: 0, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span>🌐 <b>Alamat Server Ujian CBT:</b></span>
                  <code style={{ fontSize: 13 }}>{cbtBaseUrl}/login</code>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <form action={launchCbt}>
                  <button
                    className="btn btn-primary btn-block-mobile"
                    type="submit"
                    style={{ fontSize: 16, padding: "12px 24px", minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {process.env.CBT_SSO_ENABLED === "1" ? "🚀 Masuk Ujian (tanpa ketik ulang)" : "🚀 Buka Halaman Ujian"}
                  </button>
                </form>
                {process.env.CBT_SSO_ENABLED === "1" && (
                  <a
                    className="btn btn-block-mobile"
                    href={`${cbtBaseUrl}/login`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 14, padding: "12px 20px", minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    Login manual ↗
                  </a>
                )}
              </div>

              <div className="meta" style={{ marginTop: 16, fontSize: 13, borderTop: "1px dashed var(--ink)", paddingTop: 12 }}>
                💡 <i>Tips: pastikan tidak menutup browser atau membuka tab lain selama ujian berlangsung (anti-cheat aktif).</i>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAMPILAN GURU & ADMIN */}
      {!isStudent && (
        <>
          <div className="card">
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2>Kelola Bank Soal &amp; Asesmen CBT Guru 📚</h2>
              <span className="badge badge-green">SERVER CBT AKTIF</span>
            </div>
            <div className="card-body">
              <p style={{ lineHeight: 1.6, fontSize: 15, marginBottom: 16 }}>
                Bapak/Ibu Guru dapat menyusun dan mengimpor <b>Bank Soal</b> (Pilihan Ganda, PG Kompleks, Benar/Salah, dan Menjodohkan), 
                mengatur jadwal ujian rombel, serta memantau pengerjaan siswa secara *real-time* di platform CBT.
              </p>

              <div className="alert alert-info" style={{ marginBottom: 20, padding: 14 }}>
                🔒 <b>Ketentuan Login:</b> Ketika membuka halaman ujian di bawah, Anda <b>tetap harus login ulang</b> di sistem ujian menggunakan akun panitia/guru (default: username <code>admin</code> atau akun guru yang terdaftar).
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 16 }}>
                <div className="card" style={{ margin: 0, padding: 16, border: "2px solid var(--ink)" }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>📝 Pembuatan Bank Soal</h3>
                  <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>Buat paket soal baru atau impor massal butir soal dari berkas Excel/CSV.</p>
                  <a
                    className="btn btn-primary btn-block-mobile"
                    href={`${cbtBaseUrl}/admin/bank`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", textDecoration: "none" }}
                  >
                    📚 Kelola Bank Soal ↗
                  </a>
                </div>

                <div className="card" style={{ margin: 0, padding: 16, border: "2px solid var(--ink)" }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>📊 Monitoring &amp; Sesi Ujian</h3>
                  <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>Pantau kehadiran siswa, sisa waktu, peringatan anti-cheat, dan submit.</p>
                  <a
                    className="btn btn-block-mobile"
                    href={`${cbtBaseUrl}/admin/monitoring`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", textDecoration: "none" }}
                  >
                    📋 Buka Monitoring Ujian ↗
                  </a>
                </div>

                <div className="card" style={{ margin: 0, padding: 16, border: "2px solid var(--ink)" }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>📈 Rekap Hasil &amp; Unduh Nilai</h3>
                  <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>Lihat analisis butir soal dan ekspor nilai ujian siswa dalam format Excel.</p>
                  <a
                    className="btn btn-block-mobile"
                    href={`${cbtBaseUrl}/admin/hasil`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", textDecoration: "none" }}
                  >
                    📥 Lihat Rekap Nilai CBT ↗
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <a
                  className="btn btn-yellow btn-block-mobile"
                  href={`${cbtBaseUrl}/admin/login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                >
                  🔑 Halaman Login Admin / Guru CBT ↗
                </a>
                <a
                  className="btn btn-block-mobile"
                  href={`${cbtBaseUrl}/login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                >
                  Pratinjau Tampilan Login Siswa ↗
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Jadwal Ujian Aktif di Server CBT ({exams.length} Ujian)</h2>
            </div>
            <div className="card-body">
              {exams.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {exams.map((ex) => (
                    <div
                      key={String(ex.id)}
                      className="list-row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <b style={{ fontSize: 15 }}>{ex.title}</b>
                          <span className="badge badge-yellow">⏱️ {ex.duration_minutes} Menit</span>
                          {ex.class_name && <span className="pill">Kelas {ex.class_name}</span>}
                          {ex.grade && <span className="pill">Jenjang {ex.grade}</span>}
                          <span className="badge badge-green">{ex.status.toUpperCase()}</span>
                        </div>
                        <div className="meta" style={{ fontSize: 13 }}>
                          Pelaksanaan: {ex.start_at ? new Date(ex.start_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Aktif"} · {ex.description || "Tanpa deskripsi"}
                        </div>
                      </div>

                      <a
                        className="btn btn-sm btn-block-mobile"
                        href={`${cbtBaseUrl}/admin/exams/${ex.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Detail Ujian di CBT ↗
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">Belum ada ujian yang dibuat di CBT.</div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
