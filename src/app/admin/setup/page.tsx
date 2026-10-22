import Link from "next/link";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import { setupTahunAjaran } from "./actions";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: 1, title: "Tahun ajaran aktif", desc: "Halaman ini â€” sekali saja.", href: "/admin/setup" },
  { n: 2, title: "Impor kelas (rombel)", desc: "Template: /api/templates/kelas â€” 7A..9F.", href: "/admin/akun/kelas" },
  { n: 3, title: "Impor guru", desc: "NIP = username. PIN acak dibuat otomatis.", href: "/admin/akun/guru" },
  { n: 4, title: "Penugasan + wali kelas", desc: "GuruÃ—mapelÃ—rombel + wali (FK, bukan teks).", href: "/admin/penugasan" },
  { n: 5, title: "Impor siswa", desc: "NISN = username. Auto-sync ke CBT.", href: "/admin/akun/siswa" },
  { n: 6, title: "Impor jadwal", desc: "Hari + jam + rombel + mapel + guru.", href: "/jadwal" },
  { n: 7, title: "Impor ortu", desc: "Setelah siswa ada (taut NISN anak).", href: "/admin/akun/ortu" },
];

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const me = await requireAdminSurface("admin/setup");
  const { msg, err } = await searchParams;
  const ctx = await currentSemester();
  const totalKelas = await prisma.class.count().catch(() => 0);
  const totalGuru = await prisma.user.count({ where: { role: "GURU" } }).catch(() => 0);
  const totalSiswa = await prisma.user.count({ where: { role: "SISWA" } }).catch(() => 0);

  return (
    <AppShell user={me} active="/admin/setup">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">SETUP AWAL</span>
      </nav>

      <div className="page-head">
        <h1>Setup Awal Portal ðŸ› ï¸</h1>
        <p>Urutan wajib seed data fresh (PRD v2 Â§8.2): roster resmi sekolah, bukan tebakan nama.</p>
      </div>

      {msg && <div className="alert alert-success">âœ“ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">âœ• {decodeURIComponent(err)}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Status Sekarang</h2></div>
        <div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="pill">Tahun: {ctx ? `${ctx.year.name} / ${ctx.semester.name}` : "â€” belum diset â€”"}</span>
          <span className="pill">Kelas: {totalKelas}</span>
          <span className="pill">Guru: {totalGuru}</span>
          <span className="pill">Siswa: {totalSiswa}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>1. Aktifkan Tahun Ajaran</h2></div>
        <div className="card-body">
          <form action={setupTahunAjaran} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: 6 }}>Tahun ajaran</label>
              <input name="name" className="input" defaultValue={ctx?.year.name ?? "2026/2027"} required style={{ minHeight: 44 }} />
            </div>
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: 6 }}>Semester aktif</label>
              <select name="semesterNumber" className="input" defaultValue={ctx ? String(ctx.semester.number) : "1"} style={{ minHeight: 44 }}>
                <option value="1">Ganjil</option>
                <option value="2">Genap</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" style={{ minHeight: 44 }}>
              ðŸ’¾ Aktifkan
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>2â€“7. Urutan Impor Roster</h2></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px" }}>
              <div>
                <b>{s.n}. {s.title}</b>
                <div className="meta">{s.desc}</div>
              </div>
              {s.n === 1 ? (
                <span className="badge badge-green">HALAMAN INI</span>
              ) : (
                <Link className="btn btn-sm" href={s.href} style={{ textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                  Buka â†’
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
