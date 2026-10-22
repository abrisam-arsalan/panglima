import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import FeedbackForm from "./form";
import { sendFeedback } from "./actions";

export const dynamic = "force-dynamic";

export default async function UmpanBalikPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "ORTU") {
    return (
      <AppShell user={user} active="/umpan-balik">
        <div className="empty">Halaman ini khusus orang tua.</div>
      </AppShell>
    );
  }
  const { ok, err } = await searchParams;

  // Anak ortu ini + guru yang mengajar kelas anak (assignment semester aktif).
  const links = await prisma.parentLink.findMany({
    where: { parentId: user.id },
    include: { child: { select: { id: true, nama: true, classRef: { select: { id: true, name: true } } } } },
  });
  const classIds = [...new Set(links.map((l) => l.child.classRef?.id).filter((v): v is bigint => !!v))];
  const assignments = classIds.length
    ? await prisma.assignment.findMany({
        where: { classId: { in: classIds } },
        include: {
          teacher: { select: { id: true, nama: true } },
          subject: { select: { name: true } },
          class: { select: { name: true } },
        },
        orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
      })
    : [];
  const guruMap = new Map<string, { id: string; nama: string; mapel: string[] }>();
  for (const a of assignments) {
    const key = String(a.teacher.id);
    const g = guruMap.get(key) ?? { id: key, nama: a.teacher.nama, mapel: [] };
    const tag = `${a.subject.name} (${a.class.name})`;
    if (!g.mapel.includes(tag)) g.mapel.push(tag);
    guruMap.set(key, g);
  }
  const guru = [...guruMap.values()].map((g) => ({ ...g, mapel: g.mapel.join(", ") }));

  const templat = await prisma.feedbackTemplate.findMany({
    where: { isActive: true },
    orderBy: { urutan: "asc" },
    select: { id: true, label: true },
  });

  const riwayat = await prisma.parentFeedback.findMany({
    where: { parentId: user.id },
    include: { teacher: { select: { nama: true } }, items: { include: { template: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <AppShell user={user} active="/umpan-balik">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">UMPAN BALIK GURU</span>
      </nav>

      <div className="page-head">
        <h1>Umpan Balik untuk Guru 💬</h1>
        <p>Sampaikan masukan untuk guru anak Anda. Dibaca admin &amp; kepala sekolah sebagai laporan.</p>
      </div>

      {ok && <div className="alert alert-success">✓ Umpan balik terkirim. Terima kasih atas partisipasinya.</div>}
      {err && <div className="alert alert-error">✕ {decodeURIComponent(err)}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Formulir Baru</h2></div>
        <div className="card-body">
          {guru.length === 0 ? (
            <div className="empty">Belum ada guru terdaftar untuk kelas anak Anda.</div>
          ) : (
            <FeedbackForm
              guru={guru}
              anak={links.map((l) => ({ id: String(l.childId), nama: l.child.nama }))}
              templat={templat.map((t) => ({ id: String(t.id), label: t.label }))}
              action={sendFeedback}
            />
          )}
        </div>
      </div>

      {riwayat.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Riwayat Kiriman Anda</h2></div>
          <div className="card-body">
            {riwayat.map((r) => (
              <div key={String(r.id)} className="list-row" style={{ padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <b>{r.teacher.nama}</b>
                  <span className={`badge ${r.status === "BARU" ? "badge-yellow" : r.status === "DIBACA" ? "badge-green" : "badge-neutral"}`}>
                    {r.status}
                  </span>
                </div>
                <div className="meta">
                  {new Date(r.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                  {r.items.length > 0 && ` · ${r.items.map((i) => i.template.label).join(" | ").slice(0, 160)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
