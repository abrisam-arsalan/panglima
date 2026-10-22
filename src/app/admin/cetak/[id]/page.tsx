import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSurface } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Rekap nilai per rombel: baris = siswa, kolom = asesmen (PTS/CBT/tugas-manual),
 * + rata-rata. Print-friendly A4 landscape (window.print) + unduh XLSX.
 * Dicetak wali/kepsek dengan kop + tanda tangan.
 */
export default async function CetakRombelPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminSurface("admin/cetak");
  const { id } = await params;
  const classId = BigInt(id);
  const ctx = await currentSemester();

  const rombel = await prisma.class.findUnique({
    where: { id: classId },
    include: { homeroom: { select: { nama: true } }, academicYear: { select: { name: true } } },
  });
  if (!rombel) notFound();

  const siswa = await prisma.user.findMany({
    where: { classId, role: "SISWA", deletedAt: null },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, nisn: true, isActive: true },
  });

  // Seluruh asesmen manual semester aktif yang menyentuh siswa rombel ini.
  const asesmens = await prisma.manualAssessment.findMany({
    where: {
      assignment: {
        classId,
        ...(ctx ? { semesterId: ctx.semester.id } : {}),
      },
    },
    include: {
      assignment: { include: { subject: true } },
      grades: { where: { studentId: { in: siswa.map((s) => s.id) } } },
    },
    orderBy: [{ assignment: { subject: { name: "asc" } } }, { nama: "asc" }],
  });

  const rapor = await prisma.reportScore.findMany({
    where: {
      studentId: { in: siswa.map((s) => s.id) },
      ...(ctx
        ? { assignment: { classId, semesterId: ctx.semester.id } }
        : { assignment: { classId } }),
    },
    include: { assignment: { include: { subject: true } } },
  });

  const gradeMap = new Map<string, number>();
  for (const a of asesmens) {
    for (const g of a.grades) gradeMap.set(`${a.id}|${g.studentId}`, Number(g.score));
  }
  const raporMap = new Map<string, number>();
  const raporSubjects = new Map<string, string>();
  for (const r of rapor) {
    raporMap.set(`${r.assignment.subject.name}|${r.studentId}`, Number(r.score));
    raporSubjects.set(r.assignment.subject.name, r.assignment.subject.name);
  }

  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <AppShell user={me} active="/admin/cetak">
      <style>{`@media print { .no-print { display: none !important; } .print-area { box-shadow: none !important; border: 1px solid #000 !important; } table.rekap { font-size: 11px; } }`}</style>
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <Link href="/admin/cetak">CETAK NILAI</Link>
        <span className="sep">&gt;</span>
        <span className="current">{rombel.name}</span>
      </nav>

      <div className="page-head no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Rekap Nilai {rombel.name}</h1>
          <p className="muted">{siswa.length} siswa · {asesmens.length} asesmen · {raporSubjects.size} mapel rapor</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrintButton />
          <a
            className="btn btn-sm btn-green"
            href={`/api/cetak-xlsx?classId=${rombel.id}`}
            style={{ textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}
          >
            📥 Unduh XLSX
          </a>
        </div>
      </div>

      <div className="card print-area" style={{ margin: 0 }}>
        <div className="card-body">
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <b style={{ fontSize: 16 }}>REKAPITULASI HASIL PENILAIAN TENGAH SEMESTER</b>
            <div style={{ fontSize: 14 }}>SMP Negeri 5 Tegal · Tahun {rombel.academicYear?.name ?? ctx?.year.name ?? ""}</div>
            <div style={{ fontSize: 13 }}>Rombel {rombel.name} · Wali: {rombel.homeroom?.nama ?? "—"} · {tanggal}</div>
          </div>

          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table rekap" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: 6 }}>No</th>
                  <th style={{ border: "1px solid #000", padding: 6 }}>Nama</th>
                  <th style={{ border: "1px solid #000", padding: 6 }}>NISN</th>
                  {asesmens.map((a) => (
                    <th key={String(a.id)} style={{ border: "1px solid #000", padding: 6 }}>
                      {a.assignment.subject.name}<br /><small>{a.nama}</small>
                    </th>
                  ))}
                  <th style={{ border: "1px solid #000", padding: 6 }}>Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {siswa.map((s, i) => {
                  const vals = asesmens
                    .map((a) => gradeMap.get(`${a.id}|${s.id}`))
                    .filter((v): v is number => v !== undefined);
                  const avg = vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 100) / 100 : null;
                  return (
                    <tr key={String(s.id)}>
                      <td style={{ border: "1px solid #000", padding: 6, textAlign: "center" }}>{i + 1}</td>
                      <td style={{ border: "1px solid #000", padding: 6 }}>{s.nama}{!s.isActive && " (nonaktif)"}</td>
                      <td style={{ border: "1px solid #000", padding: 6 }}>{s.nisn ?? "—"}</td>
                      {asesmens.map((a) => {
                        const v = gradeMap.get(`${a.id}|${s.id}`);
                        return (
                          <td key={String(a.id)} style={{ border: "1px solid #000", padding: 6, textAlign: "center" }}>
                            {v ?? "–"}
                          </td>
                        );
                      })}
                      <td style={{ border: "1px solid #000", padding: 6, textAlign: "center", fontWeight: 800 }}>
                        {avg ?? "–"}
                      </td>
                    </tr>
                  );
                })}
                {siswa.length === 0 && (
                  <tr><td colSpan={4 + asesmens.length} style={{ border: "1px solid #000", padding: 12, textAlign: "center" }}>Belum ada siswa di rombel ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="meta" style={{ marginTop: 8, fontSize: 12 }}>Legenda: – = tidak ikut / belum ada nilai.</div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, fontSize: 13 }}>
            <div style={{ textAlign: "center" }}>
              <div>Mengetahui,</div>
              <div>Kepala Sekolah</div>
              <div style={{ height: 64 }} />
              <div><b>( ........................................ )</b></div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div>Tegal, {tanggal}</div>
              <div>Wali Kelas {rombel.name}</div>
              <div style={{ height: 64 }} />
              <div><b>( {rombel.homeroom?.nama ?? "........................................"} )</b></div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
