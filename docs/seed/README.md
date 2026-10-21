# Seed Roster Resmi — Portal Panglima

> Data FRESH (PRD v2 D4): roster dari sumber resmi sekolah (Dapodik/operator),
> divalidasi, bukan fuzzy-match. Berkas contoh di folder ini HANYA format —
> ganti dengan data asli sebelum impor. JANGAN commit data asli ke repo.

## Urutan impor (wajib)

| # | Apa | Di mana | Template unduh | Contoh |
|---|---|---|---|---|
| 0 | Tahun ajaran aktif | `/admin/setup` | — | — |
| 1 | Kelas (rombel 7A–9F) | `/admin/akun/kelas` | `/api/templates/kelas` | `contoh-kelas.csv` |
| 2 | Guru (NIP = username) | `/admin/akun/guru` | `/api/templates/guru` | `contoh-guru.csv` |
| 3 | Penugasan + wali | `/admin/penugasan` | — (form) | — |
| 4 | Siswa (NISN = username) | `/admin/akun/siswa` | `/api/templates/siswa` | `contoh-siswa.csv` |
| 5 | Jadwal mingguan | `/jadwal` | `/api/templates/jadwal` | `contoh-jadwal.csv` |
| 6 | Ortu (taut NISN anak) | `/admin/akun/ortu` | `/api/templates/ortu` | `contoh-ortu.csv` |

## Aturan PIN

- PIN siswa: kolom `pin` (6 digit). Kosong = acak otomatis.
- PIN guru/ortu: SELALU acak otomatis (kolom pin diabaikan).
- `pinCipher` tersimpan untuk cetak kartu; login pakai bcrypt.
- Reset PIN kapan saja dari halaman akun (admin).

## Validasi otomatis (gagal = baris dilewati + dilaporkan)

- NISN/NIP/username duplikat (dalam file & DB)
- Rombel tak dikenal → dibuat otomatis + dilaporkan di `rombelBaru`
- Guru jadwal tak terdaftar → baris dilewati (buat guru dulu)
- Jam selesai ≤ jam mulai → ditolak
- Anak ortu tak ketemu (NISN) → dilewati
