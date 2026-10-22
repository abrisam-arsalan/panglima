import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { broadcastExamsAction, syncStudentsAction } from "@/app/ujian/actions";

export default async function AdminUjianPage() {
  const user = await requireAdminSurface("admin/ujian");
  const cbtBaseUrl = process.env.CBT_BASE_URL;
  if (!cbtBaseUrl) throw new Error("CBT_BASE_URL belum diset di .env");

  const totalSiswa = await prisma.user.count({
    where: { role: "SISWA", isActive: true, deletedAt: null },
  });

  // Hanya skor MANUAL (push CBT via /api/v1/tp-skor) â€” skor AUTO/LMS bukan nilai CBT.
  const totalTpScores = await prisma.tpScore.count({
    where: { source: "MANUAL" },
  });

  return (
    <AppShell user={user} active="/admin/ujian">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Integrasi CBT</span>
      </div>

      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Integrasi Sistem Ujian (CBT) ðŸ“‹</h1>
          <p>Sinkronisasi data siswa ke engine Ujian dan penerimaan hasil asesmen sumatif.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={broadcastExamsAction}>
            <button className="btn btn-sm btn-yellow btn-block-mobile" type="submit">
              ðŸ“¢ Siarkan Notifikasi Ujian
            </button>
          </form>
          <form action={syncStudentsAction}>
            <button className="btn btn-sm btn-primary btn-block-mobile" type="submit">
              ðŸ‘¥ Sync Siswa ke CBT
            </button>
          </form>
        </div>
      </div>

      <div className="stat-grid small" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ margin: 0 }}>
          <h3>ðŸŽ“ Siswa Aktif Siap Sync</h3>
          <span style={{ fontSize: 28, fontWeight: 900 }}>{totalSiswa}</span>
          <p className="meta" style={{ marginTop: 4 }}>Tersedia di endpoint <code>/api/v1/siswa</code></p>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3>ðŸ“¥ Nilai CBT Masuk</h3>
          <span style={{ fontSize: 28, fontWeight: 900 }}>{totalTpScores}</span>
          <p className="meta" style={{ marginTop: 4 }}>Diterima via push <code>/api/v1/tp-skor</code></p>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2>Status Koneksi &amp; Endpoint CBT</h2>
          <span className="badge badge-green">SERVER CBT AKTIF</span>
        </div>
        <div className="card-body">
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ width: 220, fontWeight: "bold" }}>Base URL CBT</td>
                  <td><code>{cbtBaseUrl}</code></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Endpoint Siswa</td>
                  <td><code>GET /api/v1/siswa</code> (Auth: Bearer API_TOKEN)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Endpoint Jadwal</td>
                  <td><code>GET /api/v1/jadwal</code> (Auth: Bearer API_TOKEN)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Endpoint Push Skor CBT</td>
                  <td><code>POST /api/v1/tp-skor</code> (Auth: Bearer API_TOKEN)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn btn-primary btn-block-mobile" href={`${cbtBaseUrl}/admin/bank`} target="_blank" rel="noopener noreferrer">
              ðŸ“š Buka Bank Soal CBT â†—
            </a>
            <a className="btn btn-block-mobile" href={`${cbtBaseUrl}/admin/monitoring`} target="_blank" rel="noopener noreferrer">
              ðŸ“‹ Buka Monitoring Ujian â†—
            </a>
            <a className="btn btn-yellow btn-block-mobile" href={`${cbtBaseUrl}/admin/login`} target="_blank" rel="noopener noreferrer">
              ðŸ”‘ Halaman Login Admin CBT â†—
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
