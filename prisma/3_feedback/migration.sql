-- Umpan balik ortu → guru (dibaca admin/kepsek sebagai laporan).
-- Guru TIDAK melihat langsung; tindak lanjut via kepsek/admin.

CREATE TABLE `feedback_templates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `parent_feedbacks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL,
    `teacher_id` BIGINT NOT NULL,
    `child_id` BIGINT NULL,
    `note` TEXT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'BARU',
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parent_feedbacks_status_created_at_idx`(`status`, `created_at`),
    INDEX `parent_feedbacks_teacher_id_status_idx`(`teacher_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `feedback_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `feedback_id` BIGINT NOT NULL,
    `template_id` BIGINT NOT NULL,

    UNIQUE INDEX `feedback_items_feedback_id_template_id_key`(`feedback_id`, `template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `parent_feedbacks` ADD CONSTRAINT `parent_feedbacks_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `parent_feedbacks` ADD CONSTRAINT `parent_feedbacks_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `parent_feedbacks` ADD CONSTRAINT `parent_feedbacks_child_id_fkey` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `feedback_items` ADD CONSTRAINT `feedback_items_feedback_id_fkey` FOREIGN KEY (`feedback_id`) REFERENCES `parent_feedbacks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `feedback_items` ADD CONSTRAINT `feedback_items_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `feedback_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Templat awal (tinggal klik). Admin bisa tambah/nonaktifkan di /admin/laporan.
INSERT INTO `feedback_templates` (`label`, `urutan`) VALUES
  ('Anak saya belum paham materi, mohon bimbingan tambahan', 1),
  ('Mohon info perkembangan belajar anak saya', 2),
  ('Anak saya kesulitan mengerjakan tugas, mohon arahan', 3),
  ('Terima kasih atas bimbingan Bapak/Ibu Guru', 4),
  ('Mohon jadwal konsultasi dengan Bapak/Ibu Guru', 5),
  ('Anak saya berhalangan, mohon pengertian tugas susulan', 6);
