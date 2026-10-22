import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { markRead, markAll } from "./actions";

export default async function NotifikasiPage() {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <AppShell user={user} active="/notifikasi">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Notifikasi</span>
      </div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Notifikasi</h1>
          <p className="muted">{unread ? `${unread} notifikasi belum dibaca.` : "Semua notifikasi telah dibaca."}</p>
        </div>
        {unread > 0 && (
          <form action={markAll} className="w-full-mobile">
            <button className="btn btn-sm btn-primary btn-block-mobile" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              ✓ Tandai Semua Dibaca
            </button>
          </form>
        )}
      </div>
      {rows.map((n) => (
        <div
          key={String(n.id)}
          className="list-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            padding: "12px 14px",
            marginBottom: 10,
            ...(n.readAt
              ? { opacity: 0.65 }
              : { borderLeft: "6px solid var(--teal)", background: "rgba(13, 148, 136, 0.05)" }),
          }}
        >
          <div style={{ flex: "1 1 240px", wordBreak: "break-word" }}>
            {n.link ? (
              <a href={n.link} style={{ textDecoration: "none", color: "var(--ink)" }}>
                <b style={{ fontSize: 15, display: "block", marginBottom: 4 }}>{n.message}</b>
              </a>
            ) : (
              <b style={{ fontSize: 15, display: "block", marginBottom: 4 }}>{n.message}</b>
            )}
            <div className="meta" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill" style={{ padding: "2px 8px", fontSize: 11 }}>{n.kind.toUpperCase()}</span>
              <span>📅 {new Date(n.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
          </div>
          {!n.readAt && (
            <form action={markRead} className="w-full-mobile" style={{ display: "flex", justifyContent: "flex-end" }}>
              <input type="hidden" name="id" value={String(n.id)} />
              <button
                className="btn btn-sm btn-primary btn-block-mobile"
                style={{ minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title="Tandai sudah dibaca"
              >
                ✓ Tandai Dibaca
              </button>
            </form>
          )}
        </div>
      ))}
      {!rows.length && <div className="empty">Belum ada notifikasi baru untuk akun Anda.</div>}
    </AppShell>
  );
}
