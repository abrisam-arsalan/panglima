import { parseCsv, headerIdx } from "@/lib/csv";

export type ImportKind = "siswa" | "guru" | "jadwal" | "ortu" | "kelas";

export interface RowPlan {
  line: number;      // nomor baris di file ( utk laporan )
  username: string;
  nama: string;
  nisn?: string;     // siswa — wajib (dipakai sbg username)
  kelas?: string;    // siswa — jenjang/tingkat (7, 8, 9, X, XI, XII)
  pin?: string;      // siswa — PIN login ujian & portal (misal 123456)
  nip?: string;      // guru — wajib (dipakai sbg username)
  rombel?: string;   // siswa / jadwal / kelas
  hari?: number;     // 0=Minggu .. 6=Sabtu
  hariText?: string;
  startTime?: string;// "07:30"
  endTime?: string;  // "08:50"
  mapel?: string;
  guru?: string;
  ruang?: string;
  anakNisn?: string; // ortu — NISN anak yang dihubungkan
  hubungan?: string; // ortu — AYAH / IBU / WALI
  status: "OK" | "ERR";
  reason?: string;
}

const clean = (s: string, max = 120) => s.trim().slice(0, max);

const HARI_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HARI_DICT: Record<string, number> = {
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
};

function normalizeTime(val: string): string | null {
  const v = val.trim().replace(".", ":");
  const match = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** CSV siswa — rincian: nama, nisn (sekaligus username), kelas, rombel, pin */
export function planSiswa(text: string): { rows: RowPlan[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], problems: ["File kosong."] };
  const h = headerIdx(grid[0]);
  for (const k of ["nisn", "nama"]) {
    if (h[k] === undefined && !(k === "nama" && h["nama siswa"] !== undefined))
      problems.push(`Kolom '${k}' wajib ada di header.`);
  }
  if (h["rombel"] === undefined && h["kelas"] === undefined) {
    problems.push("Kolom 'rombel' atau 'kelas' wajib ada di header.");
  }
  if (problems.length) return { rows: [], problems };

  const namaCol = h["nama"] ?? h["nama siswa"];
  const rombelCol = h["rombel"] ?? h["kelas"];
  const kelasCol = h["kelas"] !== undefined && h["rombel"] !== undefined ? h["kelas"] : (h["tingkat"] ?? h["jenjang"]);
  const pinCol = h["pin"] ?? h["password"];

  const seen = new Set<string>();
  const rows: RowPlan[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const nama = clean(r[namaCol] ?? "");
    const rombel = clean(r[rombelCol ?? -1] ?? "", 32).toUpperCase();
    const nisn = clean(r[h["nisn"] ?? -1] ?? "", 32);
    const username = nisn; // NISN sekaligus Username
    const kelas = kelasCol !== undefined ? clean(r[kelasCol] ?? "", 16) : (rombel.match(/^\d+/)?.[0] || "");
    const pin = pinCol !== undefined ? clean(r[pinCol] ?? "", 32) : "";

    let status: RowPlan["status"] = "OK";
    let reason = "";
    if (!nama) {
      status = "ERR";
      reason = "nama kosong";
    } else if (!nisn) {
      status = "ERR";
      reason = "NISN wajib diisi (dipakai sebagai username siswa)";
    } else if (!rombel) {
      status = "ERR";
      reason = "rombel wajib diisi";
    } else if (seen.has(username)) {
      status = "ERR";
      reason = "NISN duplikat dalam file";
    }

    if (status === "OK") seen.add(username);
    rows.push({
      line: i + 1,
      username,
      nama,
      nisn: nisn || undefined,
      kelas: kelas || undefined,
      rombel,
      pin: pin || undefined,
      status,
      reason: reason || undefined,
    });
  }
  return { rows, problems };
}

/** CSV guru — header minimal: nama; username dari nip/kolom username. */
export function planGuru(text: string): { rows: RowPlan[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], problems: ["File kosong."] };
  const h = headerIdx(grid[0]);
  if (h["nama"] === undefined) problems.push("Kolom 'nama' wajib ada di header.");
  if (problems.length) return { rows: [], problems };
  const seen = new Set<string>();
  const rows: RowPlan[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const nama = clean(r[h["nama"]] ?? "");
    const nip = clean(r[h["nip"] ?? -1] ?? "", 32);
    const username = clean(r[h["username"] ?? -1] ?? "") || nip;
    let status: RowPlan["status"] = "OK";
    let reason = "";
    if (!nama) { status = "ERR"; reason = "nama kosong"; }
    else if (!username) { status = "ERR"; reason = "butuh NIP atau kolom username"; }
    else if (seen.has(username)) { status = "ERR"; reason = "duplikat dalam file"; }
    if (status === "OK") seen.add(username);
    rows.push({ line: i + 1, username, nama, nip: nip || undefined, status, reason: reason || undefined });
  }
  return { rows, problems };
}

/** CSV jadwal pelajaran — header minimal: hari, jam_mulai, jam_selesai, rombel, mapel, guru. */
export function planJadwal(text: string): { rows: RowPlan[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], problems: ["File kosong."] };
  const h = headerIdx(grid[0]);

  const hariCol = h["hari"] ?? h["day"];
  const mulaiCol = h["jam_mulai"] ?? h["jam mulai"] ?? h["mulai"] ?? h["start_time"] ?? h["start"];
  const selesaiCol = h["jam_selesai"] ?? h["jam selesai"] ?? h["selesai"] ?? h["end_time"] ?? h["end"];
  const rombelCol = h["rombel"] ?? h["kelas"] ?? h["class"];
  const mapelCol = h["mapel"] ?? h["mata pelajaran"] ?? h["mata_pelajaran"] ?? h["subject"];
  const guruCol = h["guru"] ?? h["nip"] ?? h["nip_guru"] ?? h["nip guru"] ?? h["nama_guru"] ?? h["nama guru"] ?? h["username"];
  const ruangCol = h["ruang"] ?? h["ruangan"] ?? h["room"];

  if (hariCol === undefined) problems.push("Kolom 'hari' wajib ada di header.");
  if (mulaiCol === undefined) problems.push("Kolom 'jam_mulai' wajib ada di header.");
  if (selesaiCol === undefined) problems.push("Kolom 'jam_selesai' wajib ada di header.");
  if (rombelCol === undefined) problems.push("Kolom 'rombel' wajib ada di header.");
  if (mapelCol === undefined) problems.push("Kolom 'mapel' wajib ada di header.");
  if (guruCol === undefined) problems.push("Kolom 'guru' (NIP/Nama/Username) wajib ada di header.");

  if (problems.length) return { rows: [], problems };

  const seenClassTime = new Set<string>();
  const rows: RowPlan[] = [];

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const rawHari = clean(r[hariCol] ?? "").toLowerCase();
    const rawMulai = clean(r[mulaiCol] ?? "");
    const rawSelesai = clean(r[selesaiCol] ?? "");
    const rombel = clean(r[rombelCol] ?? "", 16).toUpperCase();
    const mapel = clean(r[mapelCol] ?? "", 80);
    const guru = clean(r[guruCol] ?? "", 80);
    const ruang = ruangCol !== undefined ? clean(r[ruangCol] ?? "", 60) : "";

    const dayNum = HARI_DICT[rawHari];
    const startTime = normalizeTime(rawMulai);
    const endTime = normalizeTime(rawSelesai);

    let status: RowPlan["status"] = "OK";
    let reason = "";

    if (dayNum === undefined) {
      status = "ERR";
      reason = `hari '${rawHari || "-"}' tidak dikenal (gunakan: Senin..Sabtu atau 1..6)`;
    } else if (!startTime) {
      status = "ERR";
      reason = `format jam mulai '${rawMulai || "-"}' salah (gunakan HH:MM)`;
    } else if (!endTime) {
      status = "ERR";
      reason = `format jam selesai '${rawSelesai || "-"}' salah (gunakan HH:MM)`;
    } else if (startTime >= endTime) {
      status = "ERR";
      reason = `jam mulai (${startTime}) harus lebih awal dari selesai (${endTime})`;
    } else if (!rombel || !/^\d[A-Z]?$/.test(rombel)) {
      status = "ERR";
      reason = `rombel '${rombel || "-"}' tidak valid (contoh: 9F, 7A)`;
    } else if (!mapel) {
      status = "ERR";
      reason = "nama mapel wajib diisi";
    } else if (!guru) {
      status = "ERR";
      reason = "identitas guru (NIP/Username/Nama) wajib diisi";
    } else {
      const classKey = `${dayNum}_${startTime}_${rombel}`;
      if (seenClassTime.has(classKey)) {
        status = "ERR";
        reason = `jadwal rombel ${rombel} bertabrakan pada jam yang sama dalam file`;
      } else {
        seenClassTime.add(classKey);
      }
    }

    rows.push({
      line: i + 1,
      username: guru,
      nama: `${mapel} - ${rombel}`,
      rombel,
      mapel,
      guru,
      ruang: ruang || undefined,
      hari: dayNum ?? 0,
      hariText: dayNum !== undefined ? HARI_NAMES[dayNum] : rawHari,
      startTime: startTime || rawMulai,
      endTime: endTime || rawSelesai,
      status,
      reason: reason || undefined,
    });
  }

  return { rows, problems };
}

/** CSV orang tua — header minimal: nama, anak_nisn. Username opsional (default: P<anak_nisn>). */
export function planOrtu(text: string): { rows: RowPlan[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], problems: ["File kosong."] };
  const h = headerIdx(grid[0]);

  const namaCol = h["nama"] ?? h["nama ortu"] ?? h["nama orang tua"];
  const anakNisnCol = h["anak_nisn"] ?? h["nisn_anak"] ?? h["nisn anak"] ?? h["nisn"];
  const usernameCol = h["username"];
  const hubunganCol = h["hubungan"] ?? h["relasi"];

  if (namaCol === undefined) problems.push("Kolom 'nama' wajib ada di header.");
  if (anakNisnCol === undefined) problems.push("Kolom 'anak_nisn' (NISN anak) wajib ada di header.");
  if (problems.length) return { rows: [], problems };

  const seenUsername = new Set<string>();
  const rows: RowPlan[] = [];

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const nama = clean(r[namaCol] ?? "");
    const anakNisn = clean(r[anakNisnCol] ?? "", 32);
    let username = usernameCol !== undefined ? clean(r[usernameCol] ?? "", 64) : "";
    if (!username && anakNisn) username = `P${anakNisn}`;
    const hubunganRaw = hubunganCol !== undefined ? clean(r[hubunganCol] ?? "", 20).toUpperCase() : "WALI";
    const hubungan = ["AYAH", "IBU", "WALI"].includes(hubunganRaw) ? hubunganRaw : "WALI";

    let status: RowPlan["status"] = "OK";
    let reason = "";

    if (!nama) {
      status = "ERR";
      reason = "nama orang tua kosong";
    } else if (!anakNisn) {
      status = "ERR";
      reason = "NISN anak wajib diisi";
    } else if (!username) {
      status = "ERR";
      reason = "username gagal dibuat";
    } else if (seenUsername.has(username)) {
      status = "ERR";
      reason = "duplikat username / NISN anak dalam file";
    }

    if (status === "OK") seenUsername.add(username);

    rows.push({
      line: i + 1,
      username,
      nama,
      anakNisn,
      hubungan,
      status,
      reason: reason || undefined,
    });
  }

  return { rows, problems };
}

/** CSV kelas — header minimal: nama (rombel, misal 7A); opsi: tingkat, deskripsi */
export function planKelas(text: string): { rows: RowPlan[]; problems: string[] } {
  const problems: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], problems: ["File kosong."] };
  const h = headerIdx(grid[0]);
  if (h["nama"] === undefined && h["rombel"] === undefined && h["kelas"] === undefined) {
    problems.push("Kolom 'nama' atau 'rombel' wajib ada di header.");
  }
  if (problems.length) return { rows: [], problems };

  const namaCol = h["nama"] ?? h["rombel"] ?? h["kelas"];
  const tingkatCol = h["tingkat"] ?? h["grade"] ?? h["jenjang"];
  const descCol = h["deskripsi"] ?? h["keterangan"];

  const seen = new Set<string>();
  const rows: RowPlan[] = [];

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const nama = clean(r[namaCol] ?? "", 16).toUpperCase();
    const parsedTingkat = tingkatCol !== undefined ? Number(clean(r[tingkatCol] ?? "", 4).replace(/\D/g, "")) : NaN;
    const tingkat = !isNaN(parsedTingkat) && parsedTingkat > 0
      ? parsedTingkat
      : Number(nama.match(/\d+/)?.[0] ?? 7);
    const deskripsi = descCol !== undefined ? clean(r[descCol] ?? "", 255) : "";

    let status: RowPlan["status"] = "OK";
    let reason = "";
    if (!nama) {
      status = "ERR";
      reason = "nama rombel kosong";
    } else if (seen.has(nama)) {
      status = "ERR";
      reason = "nama rombel duplikat dalam file";
    }

    if (status === "OK") seen.add(nama);
    rows.push({
      line: i + 1,
      username: nama,
      nama,
      rombel: nama,
      kelas: String(tingkat),
      ruang: deskripsi || undefined,
      status,
      reason: reason || undefined,
    });
  }
  return { rows, problems };
}

export interface ImportResult {
  created: number;
  skipped: number;
  existing: number;
  errors: string[];
  rombelBaru: string[];
}
