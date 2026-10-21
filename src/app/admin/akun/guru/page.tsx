import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import AccountNav from "@/components/account-nav";
import { importBulkAction, addTeacherAction, resetPasswordAction, toggleActiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AkunGuruPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    err?: string;
    msg?: string;
    done?: string;
    created?: string;
    existing?: string;
    skipped?: string;
  }>;
}) {
  const me = await requireRole(["ADMIN"]);
  const { q, err, msg, done, created, existing, skipped } = await searchParams;

  const teachers = await prisma.user.findMany({
    where: {
      role: "GURU",
      ...(q
        ? {
            OR: [
              { nama: { contains: q } },
              { username: { contains: q } },
              { nip: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      assignments: {
        include: { subject: { select: { name: true } }, class: { select: { name: true } } },
      },
    },
    orderBy: { nama: "asc" },
    take: 300,
  });

  return (
    <AppShell user={me} active="/admin/akun/guru">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span>AKUN</span>
        <span className="sep">&gt;</span>
        <span className="current">GURU</span>
      </nav>

      <div className="page-head">
        <h1>Data Guru &amp; Pengajar 👨‍🏫</h1>
        <p>Kelola data guru pengajar, akun login portal, dan penugasan mengajar mata pelajaran.</p>
      </div>

      <AccountNav activeTab="guru" />

      {msg && <div className="alert alert-success">✓ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">✕ {decodeURIComponent(err)}</div>}
      {done && (
        <div className="alert alert-info" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span><b>Hasil Impor Guru:</b></span>
          <span className="badge badge-green">✓ Ditambahkan: {created ?? 0}</span>
          <span className="badge badge-yellow">ℹ Sudah Ada: {existing ?? 0}</span>
          {Number(skipped) > 0 && <span className="badge badge-red">✕ Gagal: {skipped}</span>}
        </div>
      )}

      {/* ACTION CARD: BULK UPLOAD + TAMBAH MANUAL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Bulk Upload Guru */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>📥 Impor Massal Guru (CSV)</h2>
            <a href="/api/templates/guru" download className="btn btn-sm btn-yellow" style={{ textDecoration: "none" }}>
              Unduh Template
            </a>
          </div>
          <div className="card-body">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Format kolom: <code>nip,nama,username</code> (contoh: <code>198501012010011001,"Budi Santoso, S.Pd.",198501012010011001</code>). PIN / Password login akan otomatis di-generate oleh sistem.
            </p>
            <form action={importBulkAction} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="kind" value="guru" />
              <input type="hidden" name="redirectUrl" value="/admin/akun/guru" />
              <input className="input" type="file" name="file" accept=".csv,text/csv" required style={{ minHeight: 38 }} />
              <button className="btn btn-primary" type="submit">
                📤 Unggah &amp; Impor Guru
              </button>
            </form>
          </div>
        </div>

        {/* Tambah Guru Manual */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>➕ Tambah Guru Manual</h2>
          </div>
          <div className="card-body">
            <form action={addTeacherAction} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="field-label">Nama Lengkap (beserta gelar)</label>
                <input className="input" name="nama" placeholder="contoh: Budi Santoso, S.Pd." required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">NIP (Nomor Induk)</label>
                  <input className="input" name="nip" placeholder="NIP Guru" />
                </div>
                <div>
                  <label className="field-label">Username Login</label>
                  <input className="input" name="username" placeholder="Username (atau NIP)" required />
                </div>
              </div>
              <div>
                <label className="field-label">PIN / Password Sementara (Dibuat Admin)</label>
                <input className="input" name="password" placeholder="misal: 123456" defaultValue="123456" required />
              </div>
              <button className="btn btn-primary" type="submit">
                Simpan Guru
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2>Daftar Guru ({teachers.length})</h2>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari nama / NIP..."
              style={{ minHeight: 36, width: 200 }}
            />
            <button className="btn btn-sm btn-primary" type="submit">
              Filter
            </button>
            {q && (
              <Link href="/admin/akun/guru" className="btn btn-sm btn-neutral" style={{ textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </form>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Username / NIP</th>
                <th>Nama Guru</th>
                <th>Mapel &amp; Rombel Diampu</th>
                <th>PIN Login</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const mapelList = Array.from(new Set(t.assignments.map((a) => a.subject.name)));
                return (
                  <tr key={String(t.id)}>
                    <td>
                      <code>{t.username}</code>
                      {t.nip && <div className="meta">NIP: {t.nip}</div>}
                    </td>
                    <td><b>{t.nama}</b></td>
                    <td>
                      {mapelList.length > 0 ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {mapelList.map((m, idx) => (
                            <span key={idx} className="badge badge-teal">{m}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">— belum ada assignment —</span>
                      )}
                    </td>
                    <td>
                      <code>{t.pinCipher || "—"}</code>
                    </td>
                    <td>
                      <span className={`badge ${t.isActive ? "badge-green" : "badge-red"}`}>
                        {t.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <form action={resetPasswordAction}>
                          <input type="hidden" name="userId" value={String(t.id)} />
                          <input type="hidden" name="redirectUrl" value="/admin/akun/guru" />
                          <button className="btn btn-sm btn-neutral" type="submit" title="Reset PIN / Password otomatis (Acak 6 Digit)">
                            Reset PIN
                          </button>
                        </form>
                        <form action={toggleActiveAction}>
                          <input type="hidden" name="userId" value={String(t.id)} />
                          <input type="hidden" name="redirectUrl" value="/admin/akun/guru" />
                          <button className="btn btn-sm" type="submit">
                            {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!teachers.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 30 }} className="muted">
                    Tidak ada data guru ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
