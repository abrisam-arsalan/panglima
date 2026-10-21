-- ── PANGLIMA: database & user ──────────────────────────────────────────
-- GANTI password sebelum dijalankan! Jalankan SEKALI saja (setup awal server):
--   sudo mysql < db.sql
-- Skema 33 tabel dibuat via `prisma migrate deploy` (baseline 0_baseline),
-- BUKAN dari file ini — file ini hanya database + user + grant.
-- Aturan A1: schema `panglima` HANYA dimigrasi Prisma; Laravel DILARANG DDL ke sini.

CREATE DATABASE IF NOT EXISTS panglima
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'panglima_user'@'localhost'
  IDENTIFIED BY 'GANTI_PASSWORD_KUAT';

GRANT ALL PRIVILEGES ON panglima.* TO 'panglima_user'@'localhost';

-- Baca ujian CBT untuk halaman /ujian portal (getCbtExamsForUser, broadcast).
-- Grant minimal: SELECT saja, hanya tabel yang dibaca portal.
GRANT SELECT ON cbt_tka.exams TO 'panglima_user'@'localhost';
GRANT SELECT ON cbt_tka.classes TO 'panglima_user'@'localhost';

FLUSH PRIVILEGES;
