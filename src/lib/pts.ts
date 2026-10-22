import { parseCsv, headerIdx } from "@/lib/csv";

export interface PtsCell {
  mapel: string;
  skor: number;
}

export interface PtsRow {
  line: number;
  no: string;
  nama: string;
  rombel: string;
  nilai: PtsCell[];
  status: "OK" | "ERR";
  reason?: string;
}

/**
 * Parser nilai PTS paper (Google Sheet export / CSV).
 * Format sheet: baris-1 header umum (No,Nama,Kelas,...), baris-2 NAMA MAPEL,
 * baris-3 nomor kolom, baris-4+ data. By-HEADER (nama mapel), bukan by-position —
 * tahan terhadap tambah/kurang/susun-ulang kolom mapel tiap semester.
 *
 * Nilai "-" / kosong = tidak ikut → dilewati (bukan 0).
 * Diluar 0–100 → baris ERR.
 */
export function planPts(text: string): { rows: PtsRow[]; mapels: string[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (grid.length < 4) return { rows: [], mapels: [], problems: ["File kurang dari 4 baris (butuh 2 baris header + data)."] };

  // Cari baris header mapel: baris dengan sel non-kosong terbanyak di luar 3 kolom pertama.
  // Struktur baku: grid[1] = nama mapel. Fallback: pindai 3 baris pertama.
  let headerRow = 1;
  let best = -1;
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    const count = grid[r].slice(3).filter((c) => c.trim()).length;
    if (count > best) {
      best = count;
      headerRow = r;
    }
  }
  if (best < 1) return { rows: [], mapels: [], problems: ["Baris nama mapel tidak ditemukan."] };

  const h = grid[headerRow].map((c) => c.trim());
  const noCol = 0;
  const namaCol = 1;
  const kelasCol = 2;

  const mapelCols: { idx: number; mapel: string }[] = [];
  const seenMapel = new Set<string>();
  for (let c = 3; c < h.length; c++) {
    const mapel = h[c].replace(/\s+/g, " ").trim();
    if (!mapel || mapel === "-") continue;
    if (/^\d+$/.test(mapel)) continue; // baris nomor kolom nyasar
    const key = mapel.toUpperCase();
    if (seenMapel.has(key)) continue;
    seenMapel.add(key);
    mapelCols.push({ idx: c, mapel });
  }
  if (!mapelCols.length) return { rows: [], mapels: [], problems: ["Tidak ada kolom mapel terbaca."] };

  const rows: PtsRow[] = [];
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i];
    // Lewati baris nomor-kolom ("1,2,3,...") dan baris kosong.
    if (r.slice(0, 3).every((c) => /^\d*$/.test(c.trim())) && r.slice(3).every((c) => /^(-|\d*)$/.test(c.trim()))) {
      const allNum = r.every((c) => /^(-|\d*)$/.test(c.trim()));
      if (allNum) continue;
    }
    const nama = (r[namaCol] ?? "").trim().slice(0, 120);
    const rombelRaw = (r[kelasCol] ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (!nama) continue; // baris kosong

    const rombel = rombelRaw.replace(/^(\d)([A-Z])$/, "$1$2"); // "7 A" → "7A"
    const nilai: PtsCell[] = [];
    let status: PtsRow["status"] = "OK";
    let reason = "";
    for (const mc of mapelCols) {
      const raw = (r[mc.idx] ?? "").trim();
      if (!raw || raw === "-") continue; // tidak ikut
      const skor = Number(raw.replace(",", "."));
      if (!Number.isFinite(skor) || skor < 0 || skor > 100) {
        status = "ERR";
        reason = `nilai ${mc.mapel} '${raw}' tidak valid (0–100 atau -)`;
        break;
      }
      nilai.push({ mapel: mc.mapel, skor: Math.round(skor * 100) / 100 });
    }
    if (status === "OK" && !/^\d[A-Z]?$/.test(rombel)) {
      status = "ERR";
      reason = `rombel '${r[kelasCol] ?? ""}' tidak valid (contoh: 7 A)`;
    }
    rows.push({
      line: i + 1,
      no: (r[noCol] ?? "").trim(),
      nama,
      rombel,
      nilai,
      status,
      reason: reason || undefined,
    });
  }

  return { rows, mapels: mapelCols.map((m) => m.mapel), problems };
}

/** Normalisasi rombel sheet ("7 A") ke format portal ("7A"). */
export function normRombel(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}
