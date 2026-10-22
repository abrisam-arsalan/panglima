"use client";

import { useState } from "react";
import type { NavItem } from "@/lib/nav";

/**
 * Bottombar mobile: 4 favorit + tombol tengah menonjol (aksi harian) +
 * "Lainnya" (sisa menu di bottom-sheet). Maks 5 slot agar jempol akurat.
 * Item tengah = nav[2] (Presensi guru / Tugas siswa).
 */
export default function BottomNav({ nav, active }: { nav: NavItem[]; active: string }) {
  const [open, setOpen] = useState(false);
  const main = nav.slice(0, 4);
  const mid = nav[2];
  const side = [nav[0], nav[1], nav[3]];
  const rest = nav.slice(4);
  const restActive = rest.some((n) => n.href === active);

  return (
    <>
      <nav className="bottomnav bottomnav-5" aria-label="Navigasi utama">
        <BottomLink n={side[0]} active={active} />
        <BottomLink n={side[1]} active={active} />
        {mid && (
          <a
            key={mid.href}
            href={mid.href}
            className={`bn-item bn-mid ${active === mid.href ? "active" : ""}`}
            aria-label={mid.label}
          >
            <span className="bn-mid-btn">
              <span className="ico">{mid.icon}</span>
            </span>
            <span>{mid.label}</span>
          </a>
        )}
        <BottomLink n={side[2]} active={active} />
        <button
          type="button"
          className={`bn-item bn-more ${restActive ? "active" : ""}`}
          onClick={() => setOpen(true)}
          aria-label="Menu lainnya"
        >
          <span className="ico">⋯</span>
          <span>Lainnya</span>
        </button>
      </nav>

      {open && (
        <div className="bn-sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            className="bn-sheet"
            role="dialog"
            aria-label="Menu lainnya"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bn-sheet-handle" />
            <div className="bn-sheet-grid">
              {rest.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className={`bn-sheet-item ${active === n.href ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="ico">{n.icon}</span>
                  <span>{n.label}</span>
                </a>
              ))}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)} style={{ minHeight: 44, width: "100%", marginTop: 8 }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BottomLink({ n, active }: { n: NavItem | undefined; active: string }) {
  if (!n) return <span className="bn-item" aria-hidden="true" />;
  return (
    <a key={n.href} href={n.href} className={`bn-item ${active === n.href ? "active" : ""}`}>
      <span className="ico">{n.icon}</span>
      <span>{n.label}</span>
    </a>
  );
}
