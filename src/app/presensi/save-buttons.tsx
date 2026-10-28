"use client";

import { useFormStatus } from "react-dom";

/**
 * Tombol simpan presensi: biasa di paling bawah form (tanpa sticky),
 * kompak (font 14) agar tidak mendominasi layar.
 */
export default function SaveButtons() {
  const { pending } = useFormStatus();

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
      <button
        className="btn btn-primary"
        type="submit"
        name="finish"
        value="0"
        disabled={pending}
        style={{ minHeight: 46, fontSize: 14, flex: "1 1 auto" }}
      >
        {pending ? "Menyimpan…" : "💾 Simpan Draf"}
      </button>
      <button
        className="btn btn-green"
        type="submit"
        name="finish"
        value="1"
        disabled={pending}
        title="Mengunci sesi — tidak bisa diubah guru lagi (kecuali admin)"
        style={{ minHeight: 46, fontSize: 14, flex: "1 1 auto" }}
      >
        {pending ? "Menyimpan…" : "🔒 Kunci Presensi"}
      </button>
    </div>
  );
}
