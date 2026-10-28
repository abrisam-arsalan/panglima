-- LMS hardening: nonaktifkan jadwal (pengganti hapus) + koreksi rapor manual.
-- Dibuat manual (tanpa DB lokal) — kolom sederhana, backward-compatible.

-- V-P1-3: jadwal tidak lagi dihapus (RESTRICT melindungi riwayat presensi),
-- melainkan dinonaktifkan. Default true agar jadwal lama tetap tampil.
ALTER TABLE `schedules` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- Koreksi rapor guru (setReportScore) tidak boleh ditimpa recomputeReports.
ALTER TABLE `report_scores` ADD COLUMN `is_manual` BOOLEAN NOT NULL DEFAULT false;
