/**
 * Satu set ikon garis (stroke) konsisten untuk 12 modul portal.
 * 24×24, stroke 2, currentColor — ganti emoji judul yang acak.
 * Emoji dipertahankan HANYA di dalam konten buatan pengguna (pengumuman).
 */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const GlyphPresensi = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18M9 14l2 2 4-4" />
  </Svg>
);

export const GlyphTugas = () => (
  <Svg>
    <path d="M9 11l3 3 8-8" />
    <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
  </Svg>
);

export const GlyphMateri = () => (
  <Svg>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </Svg>
);

export const GlyphNilai = () => (
  <Svg>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </Svg>
);

export const GlyphJadwal = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18" />
  </Svg>
);

export const GlyphTp = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);

export const GlyphMpi = () => (
  <Svg>
    <path d="M6 12h4M8 10v4M15 13h.01M18 11h.01" />
    <path d="M17.3 5H6.7a4 4 0 0 0-4 3.6C2.5 10 2 11 2 12c0 2.5 2 4 3.5 4 .8 0 1.5-.3 2-1L9 13.5h6L16.5 15c.5.7 1.2 1 2 1 1.5 0 3.5-1.5 3.5-4 0-1-.5-2-.7-3.4a4 4 0 0 0-4-3.6z" />
  </Svg>
);

export const GlyphUjian = () => (
  <Svg>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h4" />
  </Svg>
);

export const GlyphPengumuman = () => (
  <Svg>
    <path d="M3 11l18-7-7 18-2.5-7.5z" />
  </Svg>
);

export const GlyphAkun = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </Svg>
);

export const GlyphPenugasan = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M3 9h6M3 15h6M14 12h5M14 16h5" />
  </Svg>
);

export const GlyphCetak = () => (
  <Svg>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </Svg>
);

export const GlyphFeedback = () => (
  <Svg>
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1-5.3A8.5 8.5 0 1 1 21 11.5z" />
  </Svg>
);
