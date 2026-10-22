import Link from "next/link";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import { previewPts, commitPts } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCetakPage({
  searchParams,
}: {
  searchParams: Promise<{
    err?: string; rev?: string; label?: string; cocok?: string; takCocok?: string;
    mapels?: string; baris?: string; contoh?: string;
    impor?: string; ditulis?: string; lewati?: string; rinci?: string;
  }>;
}) {
  const me = await requireAdminSurface("admin/cetak");
  const q = await searchParams;
  const ctx = await currentSemester();

  const rombels = ctx
    ? await prisma.class.findMany({
        where: { academicYearId: ctx.year.id, isActive: true },
        orderBy: [{ tingkat: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      })
    : [];

  return (
    <AppShell user={me} active="/admin/cetak">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">CETAK NILAI</span>
      </nav>

      <div className="page-head">
        <h1>Cetak Nilai</h1>
        <p>Impor nilai PTS paper (Google Sheet) / tarik nilai CBT → rekap per rombel → cetak A4 / unduh XLSX.</p>
      </div>

      {q.err && <div className="alert alert-error">✕ {decodeURIComponent(q.err)}</div>}
      {q.impor && (
        <div className="alert alert-success">
          ✓ Impor {decodeURIComponent(q.label ?? "PTS")}: <b>{q.ditulis}</b> nilai ditulis, {q.lewati} dilewati.
          {q.rinci && <div className="meta" style={{ marginTop: 6 }}>{decodeURIComponent(q.rinci)}</div>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>1. Impor Nilai PTS Paper (Google Sheet / CSV)</h2></div>
        <div className="card-body">
          <form action={previewPts} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field-label">Label asesmen (mis. PTS Ganjil 26/27)</label>
            <input name="label" className="input" defaultValue="PTS Ganjil 26/27" required style={{ minHeight: 44, maxWidth: 360 }} />
            <label className="field-label">Link Google Sheet (Anyone with the link) ATAU tempel CSV</label>
            <textarea name="sheet" className="input" rows={3} required placeholder="https://docs.google.com/spreadsheets/d/...  atau  No,Nama,Kelas,..." />
            <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 48, maxWidth: 360 }}>
              🔍 Preview &amp; Cocokkan Siswa
            </button>
          </form>

          {q.rev && (
            <form action={commitPts} style={{ marginTop: 16, padding: 14, border: "2px dashed var(--ink)" }}>
              <input type="hidden" name="rev" value={q.rev} />
              <input type="hidden" name="label" value={q.label ?? "PTS"} />
              <p>
                📊 {q.baris} baris · {q.mapels} mapel · ✅ cocok <b>{q.cocok}</b> · ⚠️ tak cocok <b>{q.takCocok}</b>
                {q.contoh && <span className="meta"> — cth: {decodeURIComponent(q.contoh)}</span>}
              </p>
              <button className="btn btn-green btn-block-mobile" type="submit" style={{ minHeight: 48 }}>
                💾 Simpan {q.cocok} Nilai ke Portal
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>2. Cetak Rekap per Rombel</h2></div>
        <div className="card-body">
          {rombels.length === 0 && <div className="empty">Belum ada rombel aktif. Selesaikan /admin/setup dulu.</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {rombels.map((r) => (
              <Link
                key={String(r.id)}
                className="btn btn-sm"
                href={`/admin/cetak/${r.id}`}
                style={{ textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}
              >
                🖨️ {r.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>3. Nilai dari Ujian CBT</h2></div>
        <div className="card-body">
          <p className="muted">
            Nilai CBT ditarik per ujian dari <code>cbt_tka</code> (menu Ujian → detail ujian) atau di-push otomatis
            via <code>POST /api/v1/tp-skor</code>. Setelah masuk portal, nilai CBT ikut tercetak di rekap rombel
            sebagai asesmen MANUAL — satu format dengan PTS paper.
          </p>
          <Link className="btn btn-sm" href="/admin/ujian" style={{ textDecoration: "none" }}>
            Buka Integrasi CBT →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
