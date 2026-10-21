import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  console.log("=================================================================");
  console.log("   SIMULASI & ANALISIS ALUR KERJA END-TO-END PORTAL PANGLIMA     ");
  console.log("=================================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 1: VERIFIKASI DATA MASTER ADMIN (JADWAL, GURU, SISWA, ORTU)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- [TAHAP 1: VERIFIKASI DATA MASTER ADMIN] ---");

  const [guruCount, siswaCount, ortuCount, jadwalCount, rombelCount] = await Promise.all([
    prisma.user.count({ where: { role: "GURU", isActive: true } }),
    prisma.user.count({ where: { role: "SISWA", isActive: true } }),
    prisma.user.count({ where: { role: "ORTU", isActive: true } }),
    prisma.schedule.count(),
    prisma.class.count({ where: { isActive: true } }),
  ]);

  console.log(`✓ Guru Aktif terdaftar     : ${guruCount} akun (Identitas: NIP)`);
  console.log(`✓ Siswa Aktif terdaftar    : ${siswaCount} akun (Identitas: NISN, tanpa NIS)`);
  console.log(`✓ Orang Tua terdaftar      : ${ortuCount} akun (Format login: P[NISN])`);
  console.log(`✓ Rombel aktif             : ${rombelCount} rombel`);
  console.log(`✓ Jadwal Pelajaran         : ${jadwalCount} slot jam pelajaran mingguan`);

  const demoGuru = await prisma.user.findFirst({ where: { username: "198501012010011001" } });
  const demoSiswa1 = await prisma.user.findFirst({ where: { username: "0115300001" }, include: { classRef: true } });
  const demoSiswa2 = await prisma.user.findFirst({ where: { username: "0115300003" }, include: { classRef: true } });
  const demoOrtu = await prisma.user.findFirst({
    where: { username: "P0115300001" },
    include: { parentLinksAsOrtu: { include: { child: true } } },
  });

  if (!demoGuru || !demoSiswa1 || !demoSiswa2 || !demoOrtu) {
    throw new Error("Akun demo belum lengkap. Jalankan seed-demo.ts terlebih dahulu.");
  }

  console.log(`✓ Guru Uji  : ${demoGuru.nama} (NIP: ${demoGuru.nip})`);
  console.log(`✓ Siswa 1   : ${demoSiswa1.nama} (NISN: ${demoSiswa1.nisn}, Rombel: ${demoSiswa1.classRef?.name})`);
  console.log(`✓ Siswa 2   : ${demoSiswa2.nama} (NISN: ${demoSiswa2.nisn}, Rombel: ${demoSiswa2.classRef?.name})`);
  console.log(`✓ Ortu Uji  : ${demoOrtu.nama} -> Terhubung ke anak: ${demoOrtu.parentLinksAsOrtu[0]?.child.nama}`);

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 2: GURU MELAKUKAN PRESENSI, MEMBUAT CATATAN KELAS, & PENGUMUMAN
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TAHAP 2: GURU PRESENSI, JURNAL CATATAN KELAS & PENGUMUMAN] ---");

  // Cari assignment Matematika 9A untuk guru demo
  const assignment = await prisma.assignment.findFirst({
    where: { teacherId: demoGuru.id, class: { name: "9A" } },
    include: { class: true, subject: true },
  });

  if (!assignment) throw new Error("Assignment Matematika 9A tidak ditemukan.");

  // Cari jadwal untuk assignment ini
  const schedule = await prisma.schedule.findFirst({
    where: { assignmentId: assignment.id },
  });

  if (!schedule) throw new Error("Jadwal Matematika 9A tidak ditemukan.");

  // Tanggal presensi hari ini (jam 00:00:00 UTC)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  // Buat atau update Sesi Presensi (ClassSession)
  const session = await prisma.classSession.upsert({
    where: { scheduleId_date: { scheduleId: schedule.id, date: todayDate } },
    create: {
      scheduleId: schedule.id,
      teacherId: demoGuru.id,
      date: todayDate,
      status: "SELESAI",
      materi: "Persamaan Linear Satu Variabel (PLSV)",
      catatanKelas: "Siswa sangat antusias memahami metode pindah ruas. Andi dan Bunga aktif bertanya, Cahyo izin sakit.",
    },
    update: {
      status: "SELESAI",
      materi: "Persamaan Linear Satu Variabel (PLSV)",
      catatanKelas: "Siswa sangat antusias memahami metode pindah ruas. Andi dan Bunga aktif bertanya, Cahyo izin sakit.",
    },
  });

  console.log(`✓ Sesi Presensi Dibuat/Diperbarui: ID ${session.id}`);
  console.log(`  Mapel          : ${assignment.subject.name} - Kelas ${assignment.class.name}`);
  console.log(`  Materi Diajar  : ${session.materi}`);
  console.log(`  Catatan Jurnal : "${session.catatanKelas}"`);

  // Catat kehadiran siswa di kelas 9A
  const students9A = await prisma.user.findMany({
    where: { classId: assignment.classId, role: "SISWA" },
    orderBy: { nama: "asc" },
  });

  for (const s of students9A) {
    const status = s.id === demoSiswa2.id ? "SAKIT" : "HADIR";
    const ket = status === "SAKIT" ? "Surat izin sakit via WA Ortu" : "Hadir tepat waktu";
    await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: s.id } },
      create: { sessionId: session.id, studentId: s.id, status, keterangan: ket },
      update: { status, keterangan: ket },
    });
    console.log(`  -> Presensi Siswa [${s.nisn}] ${s.nama.padEnd(20)}: ${status} (${ket})`);
  }

  // Buat Pengumuman oleh Guru
  const announcement = await prisma.announcement.create({
    data: {
      judul: "📢 Asesmen Formatif Bab 1 Matematika (PLSV)",
      isi: "Diberitahukan kepada seluruh siswa kelas 9A bahwa kuis formatif materi Persamaan Linear Satu Variabel akan diadakan pekan depan. Mohon membaca modul yang ada di LMS dan mengerjakan tugas tepat waktu.",
      target: "KELAS",
      classId: assignment.classId,
      authorId: demoGuru.id,
    },
  });

  console.log(`✓ Pengumuman Guru Diterbitkan: "${announcement.judul}" (Target: Kelas 9A)`);

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 3: GURU MEMBUAT KONTEN LMS LENGKAP (TP, MATERI, TUGAS)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TAHAP 3: GURU MEMBUAT KONTEN LMS (TP, MATERI, TUGAS)] ---");

  // 1. Buat Tujuan Pembelajaran (TP)
  const tp = await prisma.learningTarget.upsert({
    where: { assignmentId_code: { assignmentId: assignment.id, code: "TP-1.1" } },
    create: {
      assignmentId: assignment.id,
      code: "TP-1.1",
      content: "Memahami dan menyelesaikan masalah kontekstual yang berkaitan dengan persamaan linear satu variabel.",
      urutan: 1,
    },
    update: {},
  });
  console.log(`✓ TP Dibuat: [${tp.code}] ${tp.content}`);

  // 2. Buat Materi Pembelajaran
  const material = await prisma.material.create({
    data: {
      assignmentId: assignment.id,
      tpId: tp.id,
      judul: "Modul 1: Konsep & Penyelesaian Persamaan Linear Satu Variabel",
      body: "Persamaan linear satu variabel adalah kalimat terbuka yang dihubungkan tanda sama dengan (=) dan hanya mempunyai satu variabel berpangkat satu. Bentuk umum: ax + b = c (dengan a != 0).",
      status: "TERBIT",
      publishAt: new Date(),
      createdById: demoGuru.id,
      urutan: 1,
    },
  });
  console.log(`✓ Materi Dibuat & Terbit: "${material.judul}" (ID: ${material.id})`);

  // 3. Buat Tugas
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const task = await prisma.task.create({
    data: {
      assignmentId: assignment.id,
      tpId: tp.id,
      judul: "Tugas 1: Latihan Soal Mandiri PLSV",
      instruksi: "Selesaikan persamaan berikut dengan langkah lengkap: 1) 3x - 5 = 16. 2) 2(x + 4) = 18.",
      tipe: "TEKS",
      dueAt: dueDate,
      status: "TERBIT",
      publishAt: new Date(),
      createdById: demoGuru.id,
    },
  });
  console.log(`✓ Tugas Dibuat & Terbit: "${task.judul}" (Tipe: ${task.tipe}, Batas: ${task.dueAt.toISOString().slice(0, 10)})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 4: SISWA MELIHAT PRESENSI, PENGUMUMAN, & MENGAKSES LMS
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TAHAP 4: SISWA AKSES PRESENSI, PENGUMUMAN & LMS] ---");

  // Siswa 1 (Andi Pratama) melihat rekap presensi
  const attendanceSiswa1 = await prisma.attendanceRecord.findFirst({
    where: { studentId: demoSiswa1.id, sessionId: session.id },
    include: { session: { include: { schedule: { include: { assignment: { include: { subject: true } } } } } } },
  });
  console.log(`✓ Siswa ${demoSiswa1.nama} mengecek kehadiran:`);
  console.log(`  Mapel: ${attendanceSiswa1?.session.schedule.assignment.subject.name} -> Status: ${attendanceSiswa1?.status}`);

  // Siswa 2 (Cahyo) melihat rekap presensi
  const attendanceSiswa2 = await prisma.attendanceRecord.findFirst({
    where: { studentId: demoSiswa2.id, sessionId: session.id },
  });
  console.log(`✓ Siswa ${demoSiswa2.nama} mengecek kehadiran: Status: ${attendanceSiswa2?.status} (Keterangan: ${attendanceSiswa2?.keterangan})`);

  // Siswa membaca Pengumuman
  const announcementsForSiswa = await prisma.announcement.findMany({
    where: {
      deletedAt: null,
      OR: [{ target: "SEMUA" }, { target: "KELAS", classId: demoSiswa1.classId }],
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  console.log(`✓ Siswa membaca pengumuman kelas: "${announcementsForSiswa[0]?.judul}"`);

  // Siswa Mengakses Materi (Mencatat Waktu Baca)
  await prisma.materialRead.upsert({
    where: { materialId_userId: { materialId: material.id, userId: demoSiswa1.id } },
    create: { materialId: material.id, userId: demoSiswa1.id, readAt: new Date() },
    update: { readAt: new Date() },
  });
  console.log(`✓ Siswa ${demoSiswa1.nama} membuka modul materi -> Status: Tuntas Dibaca (Tercatat di material_reads)`);

  // Siswa Mengumpulkan Tugas
  const submission = await prisma.submission.upsert({
    where: { taskId_studentId: { taskId: task.id, studentId: demoSiswa1.id } },
    create: {
      taskId: task.id,
      studentId: demoSiswa1.id,
      text: "Jawaban Tugas 1:\n1) 3x - 5 = 16 => 3x = 21 => x = 7.\n2) 2(x + 4) = 18 => 2x + 8 = 18 => 2x = 10 => x = 5.",
      status: "ONTIME",
      submittedAt: new Date(),
    },
    update: {
      text: "Jawaban Tugas 1:\n1) 3x - 5 = 16 => 3x = 21 => x = 7.\n2) 2(x + 4) = 18 => 2x + 8 = 18 => 2x = 10 => x = 5.",
      status: "ONTIME",
      submittedAt: new Date(),
    },
  });
  console.log(`✓ Siswa ${demoSiswa1.nama} mengumpulkan tugas: Status ONTIME (Submission ID: ${submission.id})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 5: GURU MENILAI TUGAS SISWA & CAPAIAN TP
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TAHAP 5: GURU MENILAI TUGAS SISWA & CAPAIAN TP] ---");

  // Nilai tugas
  const grade = await prisma.grade.upsert({
    where: { submissionId: submission.id },
    create: {
      target: "TUGAS",
      submissionId: submission.id,
      studentId: demoSiswa1.id,
      score: 95.0,
      feedback: "Luar biasa Andi! Penyelesaian persamaan linear sangat runtut dan tepat.",
      gradedById: demoGuru.id,
      gradedAt: new Date(),
    },
    update: {
      score: 95.0,
      feedback: "Luar biasa Andi! Penyelesaian persamaan linear sangat runtut dan tepat.",
      gradedById: demoGuru.id,
      gradedAt: new Date(),
    },
  });
  console.log(`✓ Guru memberikan nilai tugas: Skor ${grade.score}/100, Catatan: "${grade.feedback}"`);

  // Rekam skor TP
  await prisma.tpScore.upsert({
    where: { tpId_studentId: { tpId: tp.id, studentId: demoSiswa1.id } },
    create: { tpId: tp.id, studentId: demoSiswa1.id, score: 95.0, source: "AUTO" },
    update: { score: 95.0, source: "AUTO" },
  });

  // Rekam flag TP Tertinggi
  await prisma.tpFlag.upsert({
    where: { tpId_studentId_type: { tpId: tp.id, studentId: demoSiswa1.id, type: "SANGAT_TERCAPAI" } },
    create: { tpId: tp.id, studentId: demoSiswa1.id, type: "SANGAT_TERCAPAI" },
    update: {},
  });
  console.log(`✓ Capaian TP siswa otomatis terupdate: 95.0 (Flag: ⭐ SANGAT_TERCAPAI)`);

  // ──────────────────────────────────────────────────────────────────────────
  // TAHAP 6: ORANG TUA MELIHAT HASIL PRESENSI & PENGUMUMAN
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TAHAP 6: ORANG TUA MEMANTAU PRESENSI, PENGUMUMAN, & NILAI] ---");

  const childId = demoOrtu.parentLinksAsOrtu[0]?.childId;
  if (!childId) throw new Error("Anak tidak ditemukan pada akun ortu");

  // Rekap kehadiran anak
  const attendanceRecordsChild = await prisma.attendanceRecord.findMany({
    where: { studentId: childId },
    include: { session: { include: { schedule: { include: { assignment: { include: { subject: true } } } } } } },
  });

  const totalSesi = attendanceRecordsChild.length;
  const totalHadir = attendanceRecordsChild.filter((r) => r.status === "HADIR").length;
  const pctHadir = totalSesi > 0 ? ((totalHadir / totalSesi) * 100).toFixed(0) : "0";

  console.log(`✓ Orang Tua (${demoOrtu.nama}) memantau portal:`);
  console.log(`  Anak Terpantau       : ${demoOrtu.parentLinksAsOrtu[0].child.nama} (Kelas 9A)`);
  console.log(`  Tingkat Kehadiran    : ${pctHadir}% (${totalHadir} hadir dari ${totalSesi} sesi)`);
  console.log(`  Sesi Terakhir        : ${attendanceRecordsChild[0]?.session.schedule.assignment.subject.name} - ${attendanceRecordsChild[0]?.status}`);
  console.log(`  Catatan Jurnal Guru  : "${attendanceRecordsChild[0]?.session.catatanKelas}"`);

  // Pengumuman sekolah yang diterima ortu
  const announcementsForOrtu = await prisma.announcement.findMany({
    where: {
      deletedAt: null,
      OR: [{ target: "SEMUA" }, { target: "KELAS", classId: demoOrtu.parentLinksAsOrtu[0].child.classId }],
    },
    take: 2,
  });
  console.log(`  Pengumuman Diterima  : [${announcementsForOrtu.length} pengumuman aktif]`);
  announcementsForOrtu.forEach((a) => console.log(`   - "${a.judul}"`));

  // Nilai anak yang terpantau
  const childGrades = await prisma.grade.findMany({
    where: { studentId: childId },
    include: { submission: { include: { task: true } } },
  });
  console.log(`  Nilai LMS Anak       :`);
  childGrades.forEach((g) => {
    console.log(`   - Tugas "${g.submission?.task.judul}": Nilai ${g.score} ("${g.feedback}")`);
  });

  console.log("\n=================================================================");
  console.log("   ✅ SELURUH SKENARIO ALUR KERJA BERHASIL DIEKSEKUSI & VALID!   ");
  console.log("=================================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Kesalahan saat simulasi alur kerja:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
