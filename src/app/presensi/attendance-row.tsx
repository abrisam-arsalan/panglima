"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@prisma/client";

const OPTS: { st: AttendanceStatus; huruf: string; ikon: string; label: string }[] = [
  { st: "HADIR", huruf: "H", ikon: "✔️", label: "Hadir" },
  { st: "SAKIT", huruf: "S", ikon: "🤒", label: "Sakit" },
  { st: "IZIN", huruf: "I", ikon: "📄", label: "Izin" },
  { st: "ALPHA", huruf: "A", ikon: "❌", label: "Alpa" },
];

/**
 * Satu baris presensi: Nama + H S I A berikon + tombol keterangan lipat.
 * Kolom keterangan hanya dibuka bila perlu (tanda 📝 menyala bila terisi).
 */
export default function AttendanceRow({
  no,
  nama,
  studentId,
  defaultStatus,
  defaultKet,
}: {
  no: number;
  nama: string;
  studentId: string;
  defaultStatus: AttendanceStatus;
  defaultKet: string;
}) {
  const [ketOpen, setKetOpen] = useState(false);
  const [ket, setKet] = useState(defaultKet);

  return (
    <>
      <div className="att-row">
        <div className="att-name" title={nama}>
          <span className="no">{no}.</span>
          {nama}
        </div>
        <div className="att-pick" role="radiogroup" aria-label={`Kehadiran ${nama}`}>
          {OPTS.map((o) => (
            <label key={o.st} className="att-opt" data-st={o.st} title={o.label}>
              <input
                type="radio"
                name={`status_${studentId}`}
                value={o.st}
                defaultChecked={defaultStatus === o.st}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
              />
              <span className="k">{o.huruf}</span>
              <span className="ic" aria-hidden="true">{o.ikon}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className={`att-ket-toggle ${ket ? "has-text" : ""}`}
          onClick={() => setKetOpen((v) => !v)}
          title={ket ? `Keterangan: ${ket}` : "Tambah keterangan"}
          aria-label={`Keterangan untuk ${nama}`}
          aria-expanded={ketOpen}
        >
          📝
        </button>
      </div>
      {ketOpen && (
        <div className="att-ket-row">
          <input
            className="input"
            style={{ width: "100%", fontSize: 13, minHeight: 44 }}
            type="text"
            name={`ket_${studentId}`}
            value={ket}
            onChange={(e) => setKet(e.target.value)}
            placeholder="Alasan izin/sakit (opsional)…"
          />
        </div>
      )}
      {/* Tanpa JS / toggle tertutup: input hidden menjaga name tetap terkirim. */}
      {!ketOpen && (
        <input type="hidden" name={`ket_${studentId}`} value={ket} />
      )}
    </>
  );
}
