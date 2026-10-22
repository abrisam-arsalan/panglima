-- Feedback gabungan ortu+siswa: kategori templat + penanda sumber laporan.

ALTER TABLE `feedback_templates` ADD COLUMN `sasaran` VARCHAR(8) NOT NULL DEFAULT 'SEMUA';
ALTER TABLE `parent_feedbacks` ADD COLUMN `sumber` VARCHAR(8) NOT NULL DEFAULT 'ORTU';

-- Templat khusus SISWA (fokus pembelajaran di kelas).
INSERT INTO `feedback_templates` (`label`, `sasaran`, `urutan`) VALUES
  ('Guru sering tidak masuk kelas', 'SISWA', 10),
  ('Guru sering terlambat datang ke kelas', 'SISWA', 11),
  ('Penjelasan guru sulit dipahami, mohon cara lain', 'SISWA', 12),
  ('Tugas terlalu banyak / menumpuk, mohon penjadwalan', 'SISWA', 13),
  ('Suasana kelas kurang kondusif saat pelajaran', 'SISWA', 14),
  ('Terima kasih, pelajaran Bapak/Ibu menyenangkan', 'SISWA', 15);

-- Templat khusus ORTU (fokus perbaikan pembelajaran via sekolah).
INSERT INTO `feedback_templates` (`label`, `sasaran`, `urutan`) VALUES
  ('Mohon peningkatan kualitas pembelajaran di kelas anak saya', 'ORTU', 20),
  ('Mohon komunikasi rutin perkembangan anak saya', 'ORTU', 21),
  ('Mohon perhatian metode mengajar yang lebih variatif', 'ORTU', 22);
