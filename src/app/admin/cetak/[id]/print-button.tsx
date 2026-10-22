"use client";

/** Tombol cetak browser (window.print hanya ada di klien). */
export default function PrintButton() {
  return (
    <button
      className="btn btn-sm btn-primary"
      type="button"
      onClick={() => window.print()}
      style={{ minHeight: 44 }}
    >
      🖨️ Cetak A4
    </button>
  );
}
