"use client";

import { useFormStatus } from "react-dom";

/**
 * Bilah simpan lengket di bawah layar sesi presensi: guru tak perlu
 * menggulir ke bawah. Dua aksi sama seperti tombol lama (draf / selesai).
 */
export default function StickySaveBar({ aboveNav = false }: { aboveNav?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: aboveNav ? "calc(var(--bottomnav-h, 64px) + env(safe-area-inset-bottom, 0px))" : 0,
        zIndex: 40,
        display: "flex",
        gap: 8,
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
        background: "var(--paper, #F5F0E6)",
        borderTop: "3px solid var(--ink, #000)",
      }}
    >
      <button
        className="btn btn-primary"
        type="submit"
        name="finish"
        value="0"
        disabled={pending}
        style={{ minHeight: 50, fontSize: 15, flex: "1 1 auto" }}
      >
        {pending ? "Menyimpan…" : "💾 Simpan Draf"}
      </button>
      <button
        className="btn btn-green"
        type="submit"
        name="finish"
        value="1"
        disabled={pending}
        style={{ minHeight: 50, fontSize: 15, flex: "1 1 auto" }}
      >
        {pending ? "Menyimpan…" : "✅ Selesai"}
      </button>
    </div>
  );
}
