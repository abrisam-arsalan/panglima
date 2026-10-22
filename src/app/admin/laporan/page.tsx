import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { setFeedbackStatus, addTemplate, toggleTemplate } from "./actions";

export const dynamic = "force-dynamic";

const STATUS = ["BARU", "DIBACA", "DITINDAKLANJUTI"] as const;

/**
 * Laporan umpan balik ortu → guru. Dibaca ADMIN & KEPSEK saja.
 * Guru tidak melihat halaman ini (tindak lanjut via kepsek/admin).
 */
export default async function AdminLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; guru?: string; sumber?: string; msg?: string; err?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "KEPSEK") redirect("/dashboard");
  const q = await searchParams;
  const statusFilter = STATUS.includes(q.status as (typeof STATUS)[number]) ? q.status! : "";
  const sumberFilter = q.sumber === "ORTU" || q.sumber === "SISWA" ? q.sumber : "";

  const [items, teachers, templates, counts] = await Promise.all([
    prisma.parentFeedback.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(sumberFilter ? { sumber: sumberFilter } : {}),
        ...(q.guru ? { teacherId: BigInt(q.guru) } : {}),
      },
      include: {
        parent: { select: { nama: true, username: true } },
        teacher: { select: { nama: true } },
        child: { select: { nama: true } },
        items: { include: { template: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: "GURU", isActive: true, deletedAt: null },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    }),
    prisma.feedbackTemplate.findMany({ orderBy: { urutan: "asc" } }),
    prisma.parentFeedback.groupBy({ by: ["status"], _count: { id: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, c._count.id]));

  return (
    <AppShell user={user} active="/admin/laporan">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">LAPORAN UMPAN BALIK</span>
      </nav>

      <div className="page-head">
        <h1>Laporan Umpan Balik 💬</h1>
        <p>Masukan ortu &amp; siswa untuk guru — bahan laporan ke kepala sekolah. Tidak terlihat oleh guru.</p>
      </div>

      {q.msg && <div className="alert alert-success">✓ {decodeURIComponent(q.msg)}</div>}
      {q.err && <div className="alert alert-error">✕ {decodeURIComponent(q.err)}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="pill">BARU: {countMap.get("BARU") ?? 0}</span>
          <span className="pill">DIBACA: {countMap.get("DIBACA") ?? 0}</span>
          <span className="pill">DITINDAKLANJUTI: {countMap.get("DITINDAKLANJUTI") ?? 0}</span>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
            <select name="status" className="input" defaultValue={statusFilter} style={{ minHeight: 44 }}>
              <option value="">Semua status</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select name="guru" className="input" defaultValue={q.guru ?? ""} style={{ minHeight: 44 }}>
              <option value="">Semua guru</option>
              {teachers.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>{t.nama}</option>
              ))}
            </select>
            <select name="sumber" className="input" defaultValue={sumberFilter} style={{ minHeight: 44 }}>
              <option value="">Ortu + Siswa</option>
              <option value="ORTU">Ortu saja</option>
              <option value="SISWA">Siswa saja</option>
            </select>
            <button className="btn btn-sm btn-primary" type="submit" style={{ minHeight: 44 }}>Filter</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Daftar Laporan ({items.length})</h2></div>
        <div className="card-body">
          {items.length === 0 && <div className="empty">Belum ada umpan balik masuk.</div>}
          {items.map((r) => (
            <div key={String(r.id)} className="list-row" style={{ padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <b>Untuk: {r.teacher.nama}</b>
                  <span className="meta">
                    {" "}· dari {r.parent.nama}
                    {r.sumber === "SISWA" ? ` (siswa${r.child ? ` ${r.child.nama}` : ""})` : r.child ? ` (ortu ${r.child.nama})` : " (ortu)"}
                  </span>
                  <span className={`badge ${r.sumber === "SISWA" ? "badge-green" : "badge-yellow"}`} style={{ marginLeft: 6 }}>
                    {r.sumber}
                  </span>
                </div>
                <span className={`badge ${r.status === "BARU" ? "badge-yellow" : r.status === "DIBACA" ? "badge-green" : "badge-neutral"}`}>
                  {r.status}
                </span>
              </div>
              <div className="meta" style={{ marginTop: 2 }}>
                {new Date(r.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              {r.items.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {r.items.map((i) => (
                    <span key={String(i.id)} className="pill">☑ {i.template.label}</span>
                  ))}
                </div>
              )}
              {r.note && (
                <div style={{ marginTop: 8, padding: 10, background: "rgba(0,0,0,0.03)", whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {r.note}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {STATUS.filter((s) => s !== r.status).map((s) => (
                  <form key={s} action={setFeedbackStatus}>
                    <input type="hidden" name="id" value={String(r.id)} />
                    <input type="hidden" name="status" value={s} />
                    <button className="btn btn-sm" type="submit" style={{ minHeight: 40 }}>
                      Tandai {s}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {user.role === "ADMIN" && (
        <div className="card">
          <div className="card-head"><h2>Kelola Templat Feedback</h2></div>
          <div className="card-body">
            <form action={addTemplate} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input name="label" className="input" placeholder="Label templat baru…" required maxLength={120} style={{ minHeight: 44, flex: "2 1 200px" }} />
              <select name="sasaran" className="input" defaultValue="SEMUA" style={{ minHeight: 44, flex: "1 1 140px" }}>
                <option value="SEMUA">Ortu + Siswa</option>
                <option value="ORTU">Ortu saja</option>
                <option value="SISWA">Siswa saja</option>
              </select>
              <button className="btn btn-sm btn-primary" type="submit" style={{ minHeight: 44 }}>Tambah</button>
            </form>
            {templates.map((t) => (
              <div key={String(t.id)} className="list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 6 }}>
                <span style={{ opacity: t.isActive ? 1 : 0.5 }}>
                  {t.label} <span className="meta">[{t.sasaran}]</span>
                </span>
                <form action={toggleTemplate}>
                  <input type="hidden" name="id" value={String(t.id)} />
                  <button className="btn btn-sm" type="submit" style={{ minHeight: 40 }}>
                    {t.isActive ? "⏸️ Nonaktifkan" : "▶️ Aktifkan"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
