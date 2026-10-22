import Link from "next/link";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import AccountNav from "@/components/account-nav";
import { importBulkAction, addParentAction, resetPasswordAction, toggleActiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AkunOrtuPage({
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
  const me = await requireAdminSurface("admin/akun/ortu");
  const { q, err, msg, done, created, existing, skipped } = await searchParams;

  const parents = await prisma.user.findMany({
    where: {
      role: "ORTU",
      ...(q
        ? {
            OR: [
              { nama: { contains: q } },
              { username: { contains: q } },
              { parentLinksAsOrtu: { some: { child: { OR: [{ nama: { contains: q } }, { nisn: { contains: q } }] } } } },
            ],
          }
        : {}),
    },
    include: {
      parentLinksAsOrtu: {
        include: { child: { select: { id: true, nama: true, nisn: true, classRef: { select: { name: true } } } } },
      },
    },
    orderBy: { nama: "asc" },
    take: 300,
  });

  return (
    <AppShell user={me} active="/admin/akun/ortu">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span>AKUN</span>
        <span className="sep">&gt;</span>
        <span className="current">ORANG TUA</span>
      </nav>

      <div className="page-head">
        <h1>Data Orang Tua Siswa ðŸ‘¨â€ðŸ‘©â€ðŸ‘§</h1>
        <p>Kelola akun wali/orang tua siswa untuk memantau presensi, tugas, dan rekap nilai anak.</p>
      </div>

      <AccountNav activeTab="ortu" />

      {msg && <div className="alert alert-success">âœ“ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">âœ• {decodeURIComponent(err)}</div>}
      {done && (
        <div className="alert alert-info" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span><b>Hasil Impor Orang Tua:</b></span>
          <span className="badge badge-green">âœ“ Ditambahkan: {created ?? 0}</span>
          <span className="badge badge-yellow">â„¹ Sudah Ada: {existing ?? 0}</span>
          {Number(skipped) > 0 && <span className="badge badge-red">âœ• Gagal: {skipped}</span>}
        </div>
      )}

      {/* ACTION CARD: BULK UPLOAD + TAMBAH MANUAL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Bulk Upload Ortu */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>ðŸ“¥ Impor Massal Orang Tua (CSV)</h2>
            <a href="/api/templates/ortu" download className="btn btn-sm btn-yellow" style={{ textDecoration: "none" }}>
              Unduh Template
            </a>
          </div>
          <div className="card-body">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Format kolom: <code>nama,anak_nisn,username,hubungan</code> (contoh: <code>"Bapak Pratama",0115300001,P0115300001,AYAH</code>). PIN / Password login akan otomatis di-generate oleh sistem.
            </p>
            <form action={importBulkAction} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="kind" value="ortu" />
              <input type="hidden" name="redirectUrl" value="/admin/akun/ortu" />
              <input className="input" type="file" name="file" accept=".csv,text/csv" required style={{ minHeight: 38 }} />
              <button className="btn btn-primary" type="submit">
                ðŸ“¤ Unggah &amp; Impor Orang Tua
              </button>
            </form>
          </div>
        </div>

        {/* Tambah Ortu Manual */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>âž• Tambah Orang Tua Manual</h2>
          </div>
          <div className="card-body">
            <form action={addParentAction} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">Nama Orang Tua</label>
                  <input className="input" name="nama" placeholder="misal: Bapak Pratama" required />
                </div>
                <div>
                  <label className="field-label">NISN Anak</label>
                  <input className="input" name="anakNisn" placeholder="10 digit NISN anak" required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">Hubungan</label>
                  <select className="input" name="hubungan" defaultValue="AYAH">
                    <option value="AYAH">Ayah</option>
                    <option value="IBU">Ibu</option>
                    <option value="WALI">Wali</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Username (Opsional, default: P+NISN)</label>
                  <input className="input" name="username" placeholder="misal: P0115300001" />
                </div>
              </div>
              <div>
                <label className="field-label">PIN / Password Sementara (Dibuat Admin)</label>
                <input className="input" name="password" placeholder="misal: 123456" defaultValue="123456" required />
              </div>
              <button className="btn btn-primary" type="submit">
                Simpan Orang Tua
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2>Daftar Orang Tua ({parents.length})</h2>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari nama ortu / anak..."
              style={{ minHeight: 36, width: 220 }}
            />
            <button className="btn btn-sm btn-primary" type="submit">
              Filter
            </button>
            {q && (
              <Link href="/admin/akun/ortu" className="btn btn-sm btn-neutral" style={{ textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </form>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama Orang Tua</th>
                <th>Siswa Terhubung (Anak)</th>
                <th>Hubungan</th>
                <th>PIN Login</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => {
                const links = p.parentLinksAsOrtu;
                return (
                  <tr key={String(p.id)}>
                    <td><code>{p.username}</code></td>
                    <td><b>{p.nama}</b></td>
                    <td>
                      {links.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {links.map((l) => (
                            <div key={String(l.child.id)}>
                              <b>{l.child.nama}</b>
                              {l.child.classRef && <span className="pill" style={{ marginLeft: 6 }}>{l.child.classRef.name}</span>}
                              <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>NISN: {l.child.nisn}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">â€” belum terhubung anak â€”</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-yellow">
                        {links[0]?.hubungan ?? "WALI"}
                      </span>
                    </td>
                    <td>
                      <code>{p.pinCipher || "â€”"}</code>
                    </td>
                    <td>
                      <span className={`badge ${p.isActive ? "badge-green" : "badge-red"}`}>
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <form action={resetPasswordAction}>
                          <input type="hidden" name="userId" value={String(p.id)} />
                          <input type="hidden" name="redirectUrl" value="/admin/akun/ortu" />
                          <button className="btn btn-sm btn-neutral" type="submit" title="Reset PIN / Password otomatis (Acak 6 Digit)">
                            Reset PIN
                          </button>
                        </form>
                        <form action={toggleActiveAction}>
                          <input type="hidden" name="userId" value={String(p.id)} />
                          <input type="hidden" name="redirectUrl" value="/admin/akun/ortu" />
                          <button className="btn btn-sm" type="submit">
                            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!parents.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30 }} className="muted">
                    Tidak ada data orang tua ditemukan.
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
