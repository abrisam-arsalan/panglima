"use client";

import { useCallback, useEffect, useState } from "react";

interface Soal {
  id: number | string;
  pertanyaan: string;
  opsiA?: string | null;
  opsiB?: string | null;
  opsiC?: string | null;
  opsiD?: string | null;
}

interface HasilItem {
  soalId: string;
  benar: boolean;
  penjelasan?: string | null;
}

const OPSI: Array<{ key: string; field: keyof Soal }> = [
  { key: "A", field: "opsiA" },
  { key: "B", field: "opsiB" },
  { key: "C", field: "opsiC" },
  { key: "D", field: "opsiD" },
];

/**
 * Mode "Main dengan soal server": soal diambil dari /api/mpi/soal
 * (TANPA kunci jawaban), koreksi via /api/mpi/jawab (P5).
 * Pengganti alur play.php lama yang membocorkan s.kunci ke klien.
 */
export default function MpiMain({
  slug,
  title,
  tingkat,
}: {
  slug: string;
  title: string;
  tingkat?: number | null;
}) {
  const [sumber, setSumber] = useState<"demo" | "guru">("guru");
  const [soal, setSoal] = useState<Soal[]>([]);
  const [jawab, setJawab] = useState<Record<string, string>>({});
  const [hasil, setHasil] = useState<{ benar: number; total: number; skor: number; hasil: HasilItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const muat = useCallback(async () => {
    setLoading(true);
    setErr("");
    setHasil(null);
    setJawab({});
    try {
      const params = new URLSearchParams({ game: slug, sumber, limit: "20", order: "rand" });
      if (tingkat) params.set("tingkat", String(tingkat));
      const res = await fetch(`/api/mpi/soal?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Gagal memuat soal");
      if (data.sumber === "demo" && sumber === "guru") {
        setSumber("demo");
      }
      setSoal(data.soal ?? []);
      if ((data.soal ?? []).length === 0) setErr("Belum ada soal untuk game ini. Minta guru mengisi bank soal / pakai soal demo.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat soal");
    } finally {
      setLoading(false);
    }
  }, [slug, sumber, tingkat]);

  const kumpul = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/mpi/jawab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: slug,
          jawaban: soal.map((s) => ({ soalId: s.id, jawab: jawab[String(s.id)] ?? "" })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Gagal mengoreksi");
      setHasil(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengoreksi");
    } finally {
      setLoading(false);
    }
  }, [soal, jawab, slug]);

  const benarMap = new Map((hasil?.hasil ?? []).map((h) => [h.soalId, h]));
  const terjawab = soal.filter((s) => jawab[String(s.id)]).length;

  // Keyboard IFP/laptop: A–D / 1–4 menjawab soal pertama yang belum terjawab.
  useEffect(() => {
    if (hasil || soal.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toUpperCase();
      const idx = ["A", "B", "C", "D"].indexOf(k) !== -1
        ? ["A", "B", "C", "D"].indexOf(k)
        : ["1", "2", "3", "4"].indexOf(k);
      if (idx === -1) return;
      const s = soal.find((x) => !jawab[String(x.id)]);
      if (!s) return;
      const opsi = OPSI.filter((o) => s[o.field]);
      if (idx >= opsi.length) return;
      setJawab((j) => ({ ...j, [String(s.id)]: opsi[idx].key }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [soal, jawab, hasil]);

  return (
    <div className="card mpi-soal">
      <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>🎯 {title} — Soal Server</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={`btn btn-sm ${sumber === "guru" ? "btn-primary" : ""}`} onClick={() => setSumber("guru")} style={{ minHeight: 40 }}>
            Soal Guru
          </button>
          <button type="button" className={`btn btn-sm ${sumber === "demo" ? "btn-primary" : ""}`} onClick={() => setSumber("demo")} style={{ minHeight: 40 }}>
            Soal Demo
          </button>
          <button type="button" className="btn btn-sm btn-green" onClick={muat} disabled={loading} style={{ minHeight: 40 }}>
            {loading ? "Memuat…" : soal.length > 0 ? "🔄 Muat Ulang" : "▶️ Mulai"}
          </button>
        </div>
      </div>
      <div className="card-body">
        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
        {hasil && (
          <div className="mpi-hasil alert alert-info" style={{ marginBottom: 16 }}>
            <div className="skor-besar">🏆 {hasil.skor}</div>
            <div style={{ fontSize: 17, marginTop: 6 }}>Benar <b>{hasil.benar}</b> dari <b>{hasil.total}</b> soal</div>
          </div>
        )}
        {soal.length > 0 && !hasil && (
          <div className="mpi-progress" aria-label={`Terjawab ${terjawab} dari ${soal.length}`}>
            <span className="muted" style={{ fontWeight: 800 }}>{terjawab}/{soal.length}</span>
            <div className="bar"><span style={{ width: `${soal.length ? Math.round((terjawab / soal.length) * 100) : 0}%` }} /></div>
            <span className="muted" style={{ fontSize: 12 }}>Tombol A–D / 1–4 menjawab</span>
          </div>
        )}
        {soal.length === 0 && !err && (
          <p className="muted">Pilih sumber soal lalu tekan Mulai. Soal dikoreksi server — kunci jawaban tidak dikirim ke browser.</p>
        )}
        {soal.map((s, i) => {
          const h = benarMap.get(String(s.id));
          return (
            <div key={String(s.id)} className="list-row" style={{ padding: "12px 14px", marginBottom: 10 }}>
              <div className="soal-teks">{i + 1}. {s.pertanyaan}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {OPSI.filter((o) => s[o.field]).map((o) => {
                  const val = String(s[o.field] ?? "");
                  const checked = jawab[String(s.id)] === o.key;
                  const mark = h ? (h.benar && checked ? " ✅" : !h.benar && checked ? " ❌" : "") : "";
                  return (
                    <label key={o.key} className="status-pill" style={{ justifyContent: "flex-start", textAlign: "left" }}>
                      <input
                        type="radio"
                        name={`jawab_${s.id}`}
                        value={o.key}
                        checked={checked}
                        disabled={!!hasil}
                        onChange={() => setJawab((j) => ({ ...j, [String(s.id)]: o.key }))}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                      />
                      <b>{o.key}.</b>&nbsp;{val}
                      {mark}
                    </label>
                  );
                })}
              </div>
              {h?.penjelasan && (
                <div style={{ fontSize: 14, marginTop: 8 }}>💡 {h.penjelasan}</div>
              )}
            </div>
          );
        })}
        {soal.length > 0 && !hasil && (
          <button type="button" className="btn btn-primary btn-block-mobile" onClick={kumpul} disabled={loading} style={{ minHeight: 48, marginTop: 8 }}>
            {loading ? "Mengoreksi…" : `📝 Kumpulkan & Koreksi (${terjawab}/${soal.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
