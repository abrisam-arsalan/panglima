-- Impor PTS idempoten: satu asesmen per (assignment, label), satu nilai per (asesmen, siswa).

-- Bersihkan duplikat yang mungkin sudah ada (impor ganda sebelum unique).
DELETE g1 FROM `grades` g1
JOIN `grades` g2
  ON g2.manual_assessment_id = g1.manual_assessment_id
 AND g2.student_id = g1.student_id
 AND g2.id < g1.id
WHERE g1.manual_assessment_id IS NOT NULL;

ALTER TABLE `grades`
  ADD UNIQUE INDEX `grades_manual_assessment_id_student_id_key`(`manual_assessment_id`, `student_id`);

ALTER TABLE `manual_assessments`
  ADD UNIQUE INDEX `manual_assessments_assignment_id_nama_key`(`assignment_id`, `nama`);
