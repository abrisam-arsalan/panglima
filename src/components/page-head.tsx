/**
 * Kepala halaman: judul tenang + sub-deskripsi + aksi opsional.
 * Aturan tahap-2: TANPA emoji di judul. Ikon modul (bila perlu) lewat
 * prop `glyph` — satu set SVG garis konsisten (components/glyph.tsx),
 * bukan emoji acak per halaman.
 */
export default function PageHead({
  title,
  sub,
  glyph,
  actions,
}: {
  title: string;
  sub?: string;
  glyph?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="page-head"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
        {glyph && (
          <span className="page-glyph" aria-hidden="true">
            {glyph}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ textTransform: "none" }}>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
      )}
    </div>
  );
}
