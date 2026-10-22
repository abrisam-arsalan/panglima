import Link from "next/link";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import AccountNav from "@/components/account-nav";
import DangerSubmit from "@/components/danger-submit";
import { importBulkAction, addClassAction, deleteClassAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AkunKelasPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string; done?: string; created?: string; existing?: string; skipped?: string }>;
}) {
  const me = await requireAdminSurface("admin/akun/kelas");
  const { err, msg, done, created, existing, skipped } = await searchParams;
  const ctx = await currentSemester();

  const classes = ctx
    ? await prisma.class.findMany({
        where: { academicYearId: ctx.year.id },
        orderBy: [{ tingkat: "asc" }, { name: "asc" }],
        include: {
          homeroom: { select: { nama: true } },
          _count: { select: { members: true } },
        },
      })
    : [];

  return (
    <AppShell user={me} active="/admin/akun/kelas">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span>AKUN</span>
        <span className="sep">&gt;</span>
        <span className="current">KELAS &amp; ROMBEL</span>
      </nav>

      <div className="page-head">
        <h1>Manajemen Kelas &amp; Rombel ðŸ«</h1>
        <p>Kelola rombel sekolah.</p>
      </div>

      <AccountNav activeTab="kelas" />

      {msg && <div className="alert alert-success">âœ“ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">âœ• {decodeURIComponent(err)}</div>}
      {done && (
        <div className="alert alert-info" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span><b>Hasil Impor CSV:</b></span>
          <span className="badge badge-green">âœ“ Ditambahkan: {created ?? 0}</span>
          <span className="badge badge-yellow">â„¹ Sudah Ada: {existing ?? 0}</span>
          {Number(skipped) > 0 && <span className="badge badge-red">âœ• Gagal: {skipped}</span>}
        </div>
      )}

      {/* ACTION CARD: UNDUH TEMPLATE & BULK UPLOAD + TAMBAH MANUAL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Bulk Upload Card */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>ðŸ“¥ Impor Massal Kelas (CSV)</h2>
            <a href="/api/templates/kelas" download className="btn btn-sm btn-yellow" style={{ textDecoration: "none" }}>
              Unduh Template
            </a>
          </div>
          <div className="card-body">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Unggah file CSV berisi kolom: <code>nama,tingkat,deskripsi</code> (contoh: <code>7A,7,Kelas 7A</code>).
            </p>
            <form action={importBulkAction} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="kind" value="kelas" />
              <input type="hidden" name="redirectUrl" value="/admin/akun/kelas" />
              <input className="input" type="file" name="file" accept=".csv,text/csv" required style={{ minHeight: 38 }} />
              <button className="btn btn-primary" type="submit">
                ðŸ“¤ Unggah &amp; Impor Kelas
              </button>
            </form>
          </div>
        </div>

        {/* Tambah Manual Card */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>âž• Tambah Rombel Manual</h2>
          </div>
          <div className="card-body">
            <form action={addClassAction} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">Nama Rombel</label>
                  <input className="input" name="name" placeholder="misal: 7A, 8B" required maxLength={16} />
                </div>
                <div>
                  <label className="field-label">Tingkat / Jenjang</label>
                  <select className="input" name="tingkat" defaultValue="7">
                    <option value="7">7 (Tujuh)</option>
                    <option value="8">8 (Delapan)</option>
                    <option value="9">9 (Sembilan)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Keterangan / Deskripsi (Opsional)</label>
                <input className="input" name="description" placeholder="contoh: Kelas Unggulan" />
              </div>
              <button className="btn btn-primary" type="submit">
                Simpan Rombel
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2>Daftar Kelas &amp; Rombel ({classes.length})</h2>
          {ctx && <span className="badge badge-teal">Tahun Ajaran: {ctx.year.name}</span>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rombel</th>
                <th>Tingkat</th>
                <th>Wali Kelas</th>
                <th>Jumlah Siswa</th>
                <th>Keterangan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={String(cls.id)}>
                  <td><b>{cls.name}</b></td>
                  <td><span className="pill">Kelas {cls.tingkat}</span></td>
                  <td>{cls.homeroom?.nama ?? <span className="muted">â€” belum diset â€”</span>}</td>
                  <td>
                    <span className="badge badge-yellow">{cls._count.members} siswa</span>
                  </td>
                  <td>{cls.description || "â€”"}</td>
                  <td>
                    <span className={`badge ${cls.isActive ? "badge-green" : "badge-neutral"}`}>
                      {cls.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    {cls._count.members === 0 ? (
                      <DangerSubmit
                        action={deleteClassAction}
                        hidden={{ classId: String(cls.id) }}
                        confirmText={`Hapus kelas ${cls.name}?`}
                        btnClass="btn btn-sm btn-red"
                      >
                        Hapus
                      </DangerSubmit>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>Terkunci</span>
                    )}
                  </td>
                </tr>
              ))}
              {!classes.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30 }} className="muted">
                    Belum ada rombel terdaftar. Silakan unggah CSV atau tambah manual di atas.
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
