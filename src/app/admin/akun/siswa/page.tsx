import Link from "next/link";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import AccountNav from "@/components/account-nav";
import { importBulkAction, addStudentAction, resetPasswordAction, toggleActiveAction } from "../actions";
import { syncStudentsAction } from "@/app/ujian/actions";

export const dynamic = "force-dynamic";

export default async function AkunSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    classId?: string;
    err?: string;
    msg?: string;
    done?: string;
    created?: string;
    existing?: string;
    skipped?: string;
    pinShow?: string;
  }>;
}) {
  const me = await requireAdminSurface("admin/akun/siswa");
  const { q, classId: rawClassId, err, msg, done, created, existing, skipped, pinShow } = await searchParams;
  const { readPinShow } = await import("@/lib/pin-show");
  const pinInfo = pinShow ? await readPinShow(me.id, pinShow) : null;
  const ctx = await currentSemester();

  const [students, classes] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "SISWA",
        ...(rawClassId ? { classId: BigInt(rawClassId) } : {}),
        ...(q
          ? {
              OR: [
                { nama: { contains: q } },
                { username: { contains: q } },
                { nisn: { contains: q } },
              ],
            }
          : {}),
      },
      include: { classRef: { select: { id: true, name: true, tingkat: true } } },
      orderBy: [{ classRef: { name: "asc" } }, { nama: "asc" }],
      take: 400,
    }),
    ctx
      ? prisma.class.findMany({
          where: { academicYearId: ctx.year.id },
          orderBy: [{ tingkat: "asc" }, { name: "asc" }],
        })
      : [],
  ]);

  return (
    <AppShell user={me} active="/admin/akun/siswa">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span>AKUN</span>
        <span className="sep">&gt;</span>
        <span className="current">SISWA</span>
      </nav>

      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Data Siswa Ã°Å¸Å½â€œ</h1>
          <p>Kelola data siswa, PIN login ujian, dan rombel. Seluruh akun siswa otomatis disinkronkan ke platform Ujian (CBT).</p>
        </div>
        <form action={syncStudentsAction}>
          <button className="btn btn-sm btn-yellow" type="submit">
            Ã°Å¸â€â€ž Sinkronkan Seluruh Siswa ke CBT
          </button>
        </form>
      </div>

      <AccountNav activeTab="siswa" />

      {msg && <div className="alert alert-success">Ã¢Å“â€œ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">Ã¢Å“â€¢ {decodeURIComponent(err)}</div>}
      {pinShow && (
        <div className="alert alert-info">
          {pinInfo ? (<>PIN baru <b>{pinInfo.nama}</b>: <code style={{ fontSize: 18 }}>{pinInfo.pin}</code> — catat sekarang, pesan ini kedaluwarsa 5 menit.</>) : (<>Tautan PIN kedaluwarsa — ulangi reset bila perlu.</>)}
        </div>
      )}
      {done && (
        <div className="alert alert-info" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span><b>Hasil Impor Siswa:</b></span>
          <span className="badge badge-green">Ã¢Å“â€œ Ditambahkan: {created ?? 0}</span>
          <span className="badge badge-yellow">Ã¢â€žÂ¹ Sudah Ada: {existing ?? 0}</span>
          {Number(skipped) > 0 && <span className="badge badge-red">Ã¢Å“â€¢ Gagal: {skipped}</span>}
          <span className="pill" style={{ marginLeft: "auto" }}>Otomatis tersinkron ke Ujian (CBT)</span>
        </div>
      )}

      {/* ACTION CARD: BULK UPLOAD + TAMBAH MANUAL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Bulk Upload Siswa */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Ã°Å¸â€œÂ¥ Impor Massal Siswa (CSV)</h2>
            <a href="/api/templates/siswa" download className="btn btn-sm btn-yellow" style={{ textDecoration: "none" }}>
              Unduh Template
            </a>
          </div>
          <div className="card-body">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Format kolom: <code>nama,nisn,kelas,rombel,pin</code> (contoh: <code>Andi Pratama,0115300001,9,9A,123456</code>). PIN login akan otomatis di-generate oleh sistem jika kolom PIN dikosongkan. NISN otomatis menjadi username login.
            </p>
            <form action={importBulkAction} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="kind" value="siswa" />
              <input type="hidden" name="redirectUrl" value="/admin/akun/siswa" />
              <input className="input" type="file" name="file" accept=".csv,text/csv" required style={{ minHeight: 38 }} />
              <button className="btn btn-primary" type="submit">
                Ã°Å¸â€œÂ¤ Unggah &amp; Impor Siswa
              </button>
            </form>
          </div>
        </div>

        {/* Tambah Siswa Manual */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <h2>Ã¢Å¾â€¢ Tambah Siswa Manual</h2>
          </div>
          <div className="card-body">
            <form action={addStudentAction} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">Nama Lengkap</label>
                  <input className="input" name="nama" placeholder="Nama siswa" required />
                </div>
                <div>
                  <label className="field-label">NISN (Username)</label>
                  <input className="input" name="nisn" placeholder="10 digit NISN" required maxLength={32} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="field-label">Rombel / Kelas</label>
                  <select className="input" name="classId" defaultValue="">
                    <option value="">Ã¢â‚¬â€ Belum Ditentukan Ã¢â‚¬â€</option>
                    {classes.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {c.name} (Kelas {c.tingkat})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">PIN Sementara (Dibuat Admin)</label>
                  <input className="input" name="pin" placeholder="misal: 123456" defaultValue="123456" required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                Simpan Siswa
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2>Daftar Siswa ({students.length})</h2>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="input" name="classId" defaultValue={rawClassId ?? ""} style={{ minHeight: 36, width: 140 }}>
              <option value="">Semua Rombel</option>
              {classes.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari nama / NISN..."
              style={{ minHeight: 36, width: 180 }}
            />
            <button className="btn btn-sm btn-primary" type="submit">
              Filter
            </button>
            {(q || rawClassId) && (
              <Link href="/admin/akun/siswa" className="btn btn-sm btn-neutral" style={{ textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </form>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>NISN / Username</th>
                <th>Nama Siswa</th>
                <th>Rombel</th>
                <th>PIN Login</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={String(s.id)}>
                  <td><code>{s.username}</code></td>
                  <td><b>{s.nama}</b></td>
                  <td>
                    {s.classRef ? (
                      <span className="badge badge-yellow">{s.classRef.name}</span>
                    ) : (
                      <span className="muted">Ã¢â‚¬â€ belum ada Ã¢â‚¬â€</span>
                    )}
                  </td>
                  <td>
                    <code>{s.pinCipher || "123456"}</code>
                  </td>
                  <td>
                    <span className={`badge ${s.isActive ? "badge-green" : "badge-red"}`}>
                      {s.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <form action={resetPasswordAction}>
                        <input type="hidden" name="userId" value={String(s.id)} />
                        <input type="hidden" name="redirectUrl" value="/admin/akun/siswa" />
                        <button className="btn btn-sm btn-neutral" type="submit" title="Reset PIN otomatis (Acak 6 Digit)">
                          Reset PIN
                        </button>
                      </form>
                      <form action={toggleActiveAction}>
                        <input type="hidden" name="userId" value={String(s.id)} />
                        <input type="hidden" name="redirectUrl" value="/admin/akun/siswa" />
                        <button className="btn btn-sm" type="submit">
                          {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!students.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30 }} className="muted">
                    Tidak ada data siswa ditemukan.
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
