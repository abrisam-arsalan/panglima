"use client";

import { useState } from "react";

interface Guru {
  id: string;
  nama: string;
  mapel: string;
}

interface Anak {
  id: string;
  nama: string;
}

interface Templat {
  id: string;
  label: string;
}

/**
 * Form umpan balik ortu: pilih guru → centang templat (boleh >1) →
 * tambah catatan bebas (boleh beberapa, digabung) → kirim.
 */
export default function FeedbackForm({
  guru,
  anak,
  templat,
  action,
}: {
  guru: Guru[];
  anak: Anak[];
  templat: Templat[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string[]>([""]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setNote = (i: number, v: string) => {
    setNotes((prev) => prev.map((n, j) => (j === i ? v : n)));
  };

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
          1. Pilih Guru
        </label>
        <select name="teacherId" className="input" required defaultValue="" style={{ minHeight: 48 }}>
          <option value="" disabled>
            — Pilih guru anak Anda —
          </option>
          {guru.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nama} — {g.mapel}
            </option>
          ))}
        </select>
      </div>

      {anak.length > 1 && (
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 6 }}>
            Anak terkait
          </label>
          <select name="childId" className="input" defaultValue={anak[0].id} style={{ minHeight: 48 }}>
            {anak.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nama}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <span className="field-label" style={{ display: "block", marginBottom: 6 }}>
          2. Klik templat (boleh lebih dari 1)
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {templat.map((t) => {
            const on = picked.has(t.id);
            return (
              <label
                key={t.id}
                className="status-pill"
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  background: on ? "var(--yellow)" : undefined,
                  fontWeight: on ? 800 : undefined,
                }}
              >
                <input
                  type="checkbox"
                  name="templates"
                  value={t.id}
                  checked={on}
                  onChange={() => toggle(t.id)}
                  style={{ width: 20, height: 20 }}
                />
                {t.label}
              </label>
            );
          })}
          {templat.length === 0 && <span className="muted">Belum ada templat aktif.</span>}
        </div>
      </div>

      <div>
        <span className="field-label" style={{ display: "block", marginBottom: 6 }}>
          3. Catatan tambahan (opsional, bisa tambah lagi)
        </span>
        {notes.map((n, i) => (
          <textarea
            key={i}
            className="input"
            rows={3}
            name={i === 0 ? "note" : `note_${i}`}
            value={n}
            onChange={(e) => setNote(i, e.target.value)}
            placeholder={`Catatan ${i + 1} — mis. hal spesifik yang ingin disampaikan...`}
            style={{ marginBottom: 8 }}
          />
        ))}
        <button
          type="button"
          className="btn btn-sm"
          style={{ minHeight: 40 }}
          onClick={() => setNotes((prev) => [...prev, ""])}
        >
          ➕ Tambah catatan lagi
        </button>
      </div>

      <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 52, fontSize: 16 }}>
        📩 Kirim Umpan Balik
      </button>
      <p className="meta" style={{ fontSize: 13 }}>
        🔒 Hanya dibaca admin &amp; kepala sekolah sebagai laporan. Guru menerima tindak lanjut via sekolah.
      </p>
    </form>
  );
}
