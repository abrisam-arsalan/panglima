import type { User } from "@prisma/client";
import { NAV, initials } from "@/lib/nav";
import { prisma } from "@/lib/prisma";
import LogoutButton from "./logout-button";
import BottomNav from "./bottomnav";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin / TU",
  GURU: "Guru",
  SISWA: "Siswa",
  ORTU: "Orang tua",
  KEPSEK: "Kepala sekolah",
};

/**
 * Kerangka halaman portal Panglima: topbar (brand + notif + avatar + keluar),
 * konten, dan bottom-nav mobile per peran.
 */
export default async function AppShell({
  user,
  active,
  children,
}: {
  user: User;
  active: string;
  children: React.ReactNode;
}) {
  const nav = NAV[user.role] ?? [];
  const isAdmin = user.role === "ADMIN";
  const showBell = true;
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/assets/logo.png" alt="Logo" />
          <span className="brand-text">
            Panglima<small>SMPN 5 Tegal</small>
          </span>
        </a>
        <div className="topbar-right">
          {showBell && (
            <a href="/notifikasi" className="bell" aria-label="Notifikasi" style={{ position: "relative" }}>
              🔔{unread > 0 && <span className="bell-dot">{unread > 99 ? "99+" : unread}</span>}
            </a>
          )}
          <span className="userchip">
            <span className="avatar">{initials(user.nama)}</span>
            <span className="user-meta">
              <b>{user.nama.split(",")[0]}</b>
              <small>{ROLE_LABEL[user.role] ?? user.role}</small>
            </span>
          </span>
          <LogoutButton />
        </div>
      </header>

      <div className={`layout${isAdmin ? " layout-admin" : ""}`}>
        {isAdmin ? (
          <aside className="sidebar">
            <nav className="side-nav">
              {nav.map((n) => {
                const isItemActive = active === n.href || (n.children && n.children.some((c) => active === c.href));
                return (
                  <div key={n.href} className="side-group" style={{ display: "flex", flexDirection: "column" }}>
                    <a
                      className={`side-item ${isItemActive && !n.children ? "active" : ""}`}
                      href={n.children ? n.children[0].href : n.href}
                    >
                      <span className="ico">{n.icon}</span>
                      <span>{n.label}</span>
                    </a>
                    {n.children && (
                      <div className="side-sub-nav" style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 14, margin: "4px 0 8px" }}>
                        {n.children.map((sub) => (
                          <a
                            key={sub.href}
                            className={`side-sub-item ${active === sub.href ? "active" : ""}`}
                            href={sub.href}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 10px",
                              fontSize: 13,
                              fontWeight: 700,
                              textDecoration: "none",
                              color: "var(--ink)",
                              borderRadius: "var(--radius-sm, 6px)",
                              background: active === sub.href ? "var(--yellow, #ffd54f)" : "transparent",
                              border: active === sub.href ? "1.5px solid var(--ink, #000)" : "1.5px solid transparent",
                              boxShadow: active === sub.href ? "1px 1px 0 var(--ink, #000)" : "none",
                            }}
                          >
                            <span>{sub.icon}</span>
                            <span>{sub.label}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
        ) : null}
        <main className="content">
          {isAdmin && active.startsWith("/admin") && (
            <div
              className="badge badge-yellow"
              style={{ display: "inline-flex", alignItems: "center", minHeight: 36, marginBottom: 12, fontSize: 13 }}
              title="Permukaan admin — terpisah dari akses guru/siswa/orang tua"
            >
              🔒 MODE ADMIN — {user.nama.split(",")[0]}
            </div>
          )}
          {children}
        </main>
      </div>

      {!isAdmin ? <BottomNav nav={nav} active={active} /> : null}
    </>
  );
}
