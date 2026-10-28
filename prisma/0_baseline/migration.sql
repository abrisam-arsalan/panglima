-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `nama` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NULL,
    `nis` VARCHAR(32) NULL,
    `nisn` VARCHAR(32) NULL,
    `nip` VARCHAR(32) NULL,
    `kode` VARCHAR(16) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `pin_cipher` TEXT NULL,
    `remember_token` VARCHAR(100) NULL,
    `role` ENUM('admin', 'guru', 'siswa', 'ortu', 'kepsek') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `must_change_pin` BOOLEAN NOT NULL DEFAULT false,
    `class_id` BIGINT NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_nis_key`(`nis`),
    UNIQUE INDEX `users_nisn_key`(`nisn`),
    UNIQUE INDEX `users_nip_key`(`nip`),
    UNIQUE INDEX `users_kode_key`(`kode`),
    INDEX `users_role_is_active_idx`(`role`, `is_active`),
    INDEX `users_class_id_role_idx`(`class_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(16) NOT NULL,
    `tingkat` TINYINT NOT NULL,
    `academic_year_id` BIGINT NOT NULL,
    `homeroom_user_id` BIGINT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `classes_academic_year_id_is_active_idx`(`academic_year_id`, `is_active`),
    UNIQUE INDEX `classes_name_academic_year_id_key`(`name`, `academic_year_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_years` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(16) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `academic_years_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semesters` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `year_id` BIGINT NOT NULL,
    `number` TINYINT NOT NULL,
    `name` VARCHAR(8) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `semesters_year_id_number_key`(`year_id`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subjects_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `teacher_id` BIGINT NOT NULL,
    `subject_id` BIGINT NOT NULL,
    `class_id` BIGINT NOT NULL,
    `semester_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `assignments_class_id_semester_id_idx`(`class_id`, `semester_id`),
    UNIQUE INDEX `assignments_teacher_id_subject_id_class_id_semester_id_key`(`teacher_id`, `subject_id`, `class_id`, `semester_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `day` TINYINT NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `room` VARCHAR(60) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `schedules_day_idx`(`day`),
    UNIQUE INDEX `schedules_assignment_id_day_start_time_key`(`assignment_id`, `day`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `schedule_id` BIGINT NOT NULL,
    `teacher_id` BIGINT NOT NULL,
    `date` DATE NOT NULL,
    `materi` TEXT NOT NULL,
    `catatan_kelas` TEXT NOT NULL,
    `status` ENUM('dibuka', 'selesai') NOT NULL DEFAULT 'dibuka',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `class_sessions_teacher_id_date_idx`(`teacher_id`, `date`),
    INDEX `class_sessions_status_idx`(`status`),
    UNIQUE INDEX `class_sessions_schedule_id_date_key`(`schedule_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `status` ENUM('hadir', 'sakit', 'izin', 'alpha') NOT NULL DEFAULT 'hadir',
    `keterangan` VARCHAR(255) NOT NULL DEFAULT '',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_records_student_id_status_idx`(`student_id`, `status`),
    UNIQUE INDEX `attendance_records_session_id_student_id_key`(`session_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parent_links` (
    `parent_id` BIGINT NOT NULL,
    `child_id` BIGINT NOT NULL,
    `hubungan` ENUM('ayah', 'ibu', 'wali') NOT NULL DEFAULT 'wali',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parent_links_child_id_idx`(`child_id`),
    UNIQUE INDEX `parent_links_parent_id_key`(`parent_id`),
    PRIMARY KEY (`parent_id`, `child_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `learning_targets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `content` TEXT NOT NULL,
    `urutan` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `learning_targets_assignment_id_code_key`(`assignment_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `tp_id` BIGINT NULL,
    `judul` VARCHAR(200) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `status` ENUM('draf', 'terbit') NOT NULL DEFAULT 'draf',
    `publish_at` DATETIME(3) NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `materials_assignment_id_status_urutan_idx`(`assignment_id`, `status`, `urutan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_files` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `material_id` BIGINT NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(128) NOT NULL,
    `mime` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `material_files_stored_name_key`(`stored_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_reads` (
    `material_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`material_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `tp_id` BIGINT NULL,
    `judul` VARCHAR(200) NOT NULL,
    `instruksi` LONGTEXT NOT NULL,
    `tipe` ENUM('file', 'teks', 'centang') NOT NULL DEFAULT 'file',
    `due_at` DATETIME(3) NOT NULL,
    `late_until` DATETIME(3) NULL,
    `max_file_mb` INTEGER NOT NULL DEFAULT 20,
    `status` ENUM('draf', 'terbit') NOT NULL DEFAULT 'draf',
    `publish_at` DATETIME(3) NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `tasks_assignment_id_status_due_at_idx`(`assignment_id`, `status`, `due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_files` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(128) NOT NULL,
    `mime` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `task_files_stored_name_key`(`stored_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `text` TEXT NULL,
    `status` ENUM('ontime', 'late') NOT NULL DEFAULT 'ontime',
    `revisi_count` INTEGER NOT NULL DEFAULT 0,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `submissions_task_id_student_id_key`(`task_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission_files` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `submission_id` BIGINT NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(128) NOT NULL,
    `mime` VARCHAR(120) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `submission_files_stored_name_key`(`stored_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manual_assessments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `tp_id` BIGINT NULL,
    `nama` VARCHAR(80) NOT NULL,
    `keterangan` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `target` ENUM('tugas', 'manual') NOT NULL,
    `submission_id` BIGINT NULL,
    `manual_assessment_id` BIGINT NULL,
    `student_id` BIGINT NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `feedback` TEXT NULL,
    `graded_by` BIGINT NOT NULL,
    `graded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `grades_submission_id_key`(`submission_id`),
    INDEX `grades_manual_assessment_id_student_id_idx`(`manual_assessment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tp_scores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tp_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `source` ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tp_scores_student_id_idx`(`student_id`),
    UNIQUE INDEX `tp_scores_tp_id_student_id_key`(`tp_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tp_flags` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tp_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `type` ENUM('perlu_peningkatan', 'sangat_tercapai') NOT NULL,

    UNIQUE INDEX `tp_flags_tp_id_student_id_type_key`(`tp_id`, `student_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_scores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `assignment_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `report_scores_assignment_id_student_id_key`(`assignment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `judul` VARCHAR(200) NOT NULL,
    `isi` LONGTEXT NOT NULL,
    `target` ENUM('semua', 'kelas') NOT NULL DEFAULT 'semua',
    `class_id` BIGINT NULL,
    `author_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `announcements_target_class_id_idx`(`target`, `class_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `message` VARCHAR(255) NOT NULL,
    `link` VARCHAR(255) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `token` VARCHAR(64) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `user_id` BIGINT NULL,
    `success` BOOLEAN NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_username_created_at_idx`(`username`, `created_at`),
    INDEX `login_attempts_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handoff_codes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code_hash` CHAR(64) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `target` VARCHAR(32) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `handoff_codes_code_hash_key`(`code_hash`),
    INDEX `handoff_codes_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity` VARCHAR(60) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `detail` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` VARCHAR(500) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mpi_games` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `nama` VARCHAR(160) NOT NULL,
    `deskripsi` TEXT NULL,
    `icon` VARCHAR(20) NOT NULL DEFAULT '🎮',
    `file_path` VARCHAR(255) NOT NULL DEFAULT '',
    `tipe` VARCHAR(40) NOT NULL,
    `owner_id` BIGINT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mpi_games_slug_key`(`slug`),
    INDEX `mpi_games_aktif_urutan_idx`(`aktif`, `urutan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mpi_subjects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mpi_subjects_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mpi_questions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `game_id` BIGINT NOT NULL,
    `mpi_subject_id` BIGINT NULL,
    `tingkat` TINYINT NULL,
    `pertanyaan` TEXT NOT NULL,
    `opsi_a` VARCHAR(255) NULL DEFAULT 'Benar',
    `opsi_b` VARCHAR(255) NULL DEFAULT 'Salah',
    `opsi_c` VARCHAR(255) NULL,
    `opsi_d` VARCHAR(255) NULL,
    `answer_key` VARCHAR(8) NOT NULL,
    `explanation` TEXT NULL,
    `payload` JSON NULL,
    `is_demo` BOOLEAN NOT NULL DEFAULT false,
    `owner_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mpi_questions_game_id_is_demo_idx`(`game_id`, `is_demo`),
    INDEX `mpi_questions_game_id_tingkat_mpi_subject_id_idx`(`game_id`, `tingkat`, `mpi_subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_homeroom_user_id_fkey` FOREIGN KEY (`homeroom_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semesters` ADD CONSTRAINT `semesters_year_id_fkey` FOREIGN KEY (`year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_links` ADD CONSTRAINT `parent_links_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_links` ADD CONSTRAINT `parent_links_child_id_fkey` FOREIGN KEY (`child_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `learning_targets` ADD CONSTRAINT `learning_targets_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_tp_id_fkey` FOREIGN KEY (`tp_id`) REFERENCES `learning_targets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_files` ADD CONSTRAINT `material_files_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_reads` ADD CONSTRAINT `material_reads_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_reads` ADD CONSTRAINT `material_reads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_tp_id_fkey` FOREIGN KEY (`tp_id`) REFERENCES `learning_targets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_files` ADD CONSTRAINT `task_files_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_files` ADD CONSTRAINT `submission_files_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_assessments` ADD CONSTRAINT `manual_assessments_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_assessments` ADD CONSTRAINT `manual_assessments_tp_id_fkey` FOREIGN KEY (`tp_id`) REFERENCES `learning_targets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_manual_assessment_id_fkey` FOREIGN KEY (`manual_assessment_id`) REFERENCES `manual_assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_graded_by_fkey` FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tp_scores` ADD CONSTRAINT `tp_scores_tp_id_fkey` FOREIGN KEY (`tp_id`) REFERENCES `learning_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tp_scores` ADD CONSTRAINT `tp_scores_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tp_flags` ADD CONSTRAINT `tp_flags_tp_id_fkey` FOREIGN KEY (`tp_id`) REFERENCES `learning_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tp_flags` ADD CONSTRAINT `tp_flags_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_scores` ADD CONSTRAINT `report_scores_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_scores` ADD CONSTRAINT `report_scores_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handoff_codes` ADD CONSTRAINT `handoff_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mpi_games` ADD CONSTRAINT `mpi_games_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mpi_questions` ADD CONSTRAINT `mpi_questions_game_id_fkey` FOREIGN KEY (`game_id`) REFERENCES `mpi_games`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mpi_questions` ADD CONSTRAINT `mpi_questions_mpi_subject_id_fkey` FOREIGN KEY (`mpi_subject_id`) REFERENCES `mpi_subjects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mpi_questions` ADD CONSTRAINT `mpi_questions_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

