/**
 * prisma/seed-demo.ts
 * Seed akun demo: 5 guru, 5 siswa, 5 orang tua + jadwal pelajaran
 * Jalankan: npx ts-node --project tsconfig.json -e "require('./prisma/seed-demo')"
 * Atau     : npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const PIN = "123456";
const SCHOOL_YEAR = "2026/2027";

async function main() {
  console.log("🌱 Mulai seed demo...\n");
  const hash = await bcrypt.hash(PIN, 10);

  // ── 1. Tahun ajaran & semester ──────────────────────────────────────────
  let year = await prisma.academicYear.findUnique({ where: { name: SCHOOL_YEAR } });
  if (!year) {
    year = await prisma.academicYear.create({
      data: {
        name: SCHOOL_YEAR,
        startDate: new Date("2026-07-14"),
        endDate: new Date("2027-06-30"),
        isActive: true,
      },
    });
    console.log(`✓ Tahun ajaran ${SCHOOL_YEAR} dibuat`);
  } else {
    await prisma.academicYear.update({ where: { id: year.id }, data: { isActive: true } });
    console.log(`ℹ Tahun ajaran ${SCHOOL_YEAR} sudah ada`);
  }

  let semester = await prisma.semester.findUnique({
    where: { yearId_number: { yearId: year.id, number: 1 } },
  });
  if (!semester) {
    semester = await prisma.semester.create({
      data: { yearId: year.id, number: 1, name: "Ganjil", isActive: true },
    });
    console.log(`✓ Semester Ganjil dibuat`);
  }

  // ── 2. Rombel ────────────────────────────────────────────────────────────
  const rombelList = ["9A", "9B"] as const;
  const rombelMap = new Map<string, bigint>();

  for (const r of rombelList) {
    const tingkat = parseInt(r[0]);
    const cls = await prisma.class.upsert({
      where: { name_academicYearId: { name: r, academicYearId: year.id } },
      create: { name: r, tingkat, academicYearId: year.id, isActive: true },
      update: {},
    });
    rombelMap.set(r, cls.id);
    console.log(`✓ Rombel ${r} ready`);
  }

  // ── 3. Mata Pelajaran ────────────────────────────────────────────────────
  const subjects = [
    { name: "Matematika", code: "MTK" },
    { name: "Bahasa Indonesia", code: "BIND" },
    { name: "Bahasa Inggris", code: "BING" },
    { name: "Ilmu Pengetahuan Alam", code: "IPA" },
    { name: "Pendidikan Agama Islam", code: "PAI" },
  ];
  const subjectMap = new Map<string, bigint>();
  for (const s of subjects) {
    const subj = await prisma.subject.upsert({
      where: { name: s.name },
      create: s,
      update: {},
    });
    subjectMap.set(s.name, subj.id);
    console.log(`✓ Mapel ${s.name} ready`);
  }

  // ── 4. Guru (5 akun) ─────────────────────────────────────────────────────
  const guruData = [
    { nip: "198501012010011001", nama: "Budi Santoso, S.Pd.", username: "198501012010011001", mapel: "Matematika" },
    { nip: "198803152015022002", nama: "Siti Rahayu, M.Pd.",  username: "198803152015022002", mapel: "Bahasa Indonesia" },
    { nip: "199001202018011003", nama: "Ahmad Fauzi, S.Si.",  username: "199001202018011003", mapel: "Ilmu Pengetahuan Alam" },
    { nip: "199205112019012004", nama: "Dewi Anggraini, S.Pd.", username: "199205112019012004", mapel: "Bahasa Inggris" },
    { nip: "199312302020011005", nama: "Rizky Pratama, S.Pd.I.", username: "199312302020011005", mapel: "Pendidikan Agama Islam" },
  ];

  const guruIds = new Map<string, bigint>();
  for (const g of guruData) {
    const exist = await prisma.user.findUnique({ where: { username: g.username } });
    if (exist) {
      guruIds.set(g.mapel, exist.id);
      console.log(`ℹ Guru ${g.nama} sudah ada (${g.username})`);
      continue;
    }
    const u = await prisma.user.create({
      data: {
        username: g.username,
        nama: g.nama,
        role: "GURU",
        passwordHash: hash,
        nip: g.nip,
        mustChangePin: false, // demo — PIN sudah diketahui
      },
    });
    guruIds.set(g.mapel, u.id);
    console.log(`✓ Guru ${g.nama} dibuat  (login: ${g.username} / PIN: ${PIN})`);
  }

  // ── 5. Siswa (5 akun) ─────────────────────────────────────────────────────
  const siswaData = [
    { nisn: "0115300001", nama: "Andi Pratama",        rombel: "9A" },
    { nisn: "0115300002", nama: "Bunga Citra Lestari", rombel: "9A" },
    { nisn: "0115300003", nama: "Cahyo Nugroho",       rombel: "9A" },
    { nisn: "0115300004", nama: "Dewi Sartika",        rombel: "9B" },
    { nisn: "0115300005", nama: "Eko Firmansyah",      rombel: "9B" },
  ];

  const siswaIds = new Map<string, bigint>(); // nisn → id
  for (const s of siswaData) {
    const classId = rombelMap.get(s.rombel)!;
    const exist = await prisma.user.findUnique({ where: { username: s.nisn } });
    if (exist) {
      siswaIds.set(s.nisn, exist.id);
      console.log(`ℹ Siswa ${s.nama} sudah ada (${s.nisn})`);
      continue;
    }
    const u = await prisma.user.create({
      data: {
        username: s.nisn,
        nama: s.nama,
        role: "SISWA",
        passwordHash: hash,
        nisn: s.nisn,
        classId,
        mustChangePin: false,
      },
    });
    siswaIds.set(s.nisn, u.id);
    console.log(`✓ Siswa ${s.nama} dibuat  (login: ${s.nisn} / PIN: ${PIN})`);
  }

  // ── 6. Orang Tua (5 akun) ─────────────────────────────────────────────────
  const ortuData = [
    { username: "P0115300001", nama: "Bapak Pratama (Ortu Andi)",   anakNisn: "0115300001", hubungan: "AYAH" as const },
    { username: "P0115300002", nama: "Ibu Lestari (Ortu Bunga)",    anakNisn: "0115300002", hubungan: "IBU" as const },
    { username: "P0115300003", nama: "Bapak Nugroho (Ortu Cahyo)",  anakNisn: "0115300003", hubungan: "AYAH" as const },
    { username: "P0115300004", nama: "Ibu Sartika (Ortu Dewi)",     anakNisn: "0115300004", hubungan: "IBU" as const },
    { username: "P0115300005", nama: "Bapak Firmansyah (Ortu Eko)", anakNisn: "0115300005", hubungan: "AYAH" as const },
  ];

  for (const o of ortuData) {
    const anakId = siswaIds.get(o.anakNisn);
    if (!anakId) { console.log(`⚠ Anak ${o.anakNisn} tidak ditemukan, lewati`); continue; }

    const exist = await prisma.user.findUnique({ where: { username: o.username } });
    let ortuId: bigint;
    if (exist) {
      ortuId = exist.id;
      console.log(`ℹ Ortu ${o.nama} sudah ada (${o.username})`);
    } else {
      const u = await prisma.user.create({
        data: {
          username: o.username,
          nama: o.nama,
          role: "ORTU",
          passwordHash: hash,
          mustChangePin: false,
        },
      });
      ortuId = u.id;
      console.log(`✓ Ortu ${o.nama} dibuat  (login: ${o.username} / PIN: ${PIN})`);
    }

    // Parent link
    const existLink = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId: ortuId, childId: anakId } },
    });
    if (!existLink) {
      await prisma.parentLink.create({
        data: { parentId: ortuId, childId: anakId, hubungan: "WALI" },
      });
      console.log(`  ↳ Dihubungkan ke anak: ${o.anakNisn}`);
    }
  }

  // ── 7. Assignment (penugasan guru × mapel × rombel × semester) ───────────
  const assignments: Array<{ guruMapel: string; rombel: string; assignId?: bigint }> = [
    { guruMapel: "Matematika",            rombel: "9A" },
    { guruMapel: "Matematika",            rombel: "9B" },
    { guruMapel: "Bahasa Indonesia",      rombel: "9A" },
    { guruMapel: "Bahasa Indonesia",      rombel: "9B" },
    { guruMapel: "Ilmu Pengetahuan Alam", rombel: "9A" },
    { guruMapel: "Bahasa Inggris",        rombel: "9B" },
    { guruMapel: "Pendidikan Agama Islam",rombel: "9A" },
    { guruMapel: "Pendidikan Agama Islam",rombel: "9B" },
  ];

  const assignMap = new Map<string, bigint>(); // "mapel|rombel" → assignmentId

  for (const a of assignments) {
    const teacherId = guruIds.get(a.guruMapel);
    const subjectId = subjectMap.get(a.guruMapel);
    const classId = rombelMap.get(a.rombel);
    if (!teacherId || !subjectId || !classId) {
      console.log(`⚠ Skip assignment ${a.guruMapel} × ${a.rombel}: data tidak lengkap`);
      continue;
    }
    const asg = await prisma.assignment.upsert({
      where: { teacherId_subjectId_classId_semesterId: { teacherId, subjectId, classId, semesterId: semester.id } },
      create: { teacherId, subjectId, classId, semesterId: semester.id },
      update: {},
    });
    assignMap.set(`${a.guruMapel}|${a.rombel}`, asg.id);
    console.log(`✓ Assignment ${a.guruMapel} × ${a.rombel} ready`);
  }

  // ── 8. Jadwal Pelajaran ──────────────────────────────────────────────────
  // Hari: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat
  const jadwalData: Array<{ mapel: string; rombel: string; day: number; start: string; end: string; room: string }> = [
    { mapel: "Matematika",            rombel: "9A", day: 1, start: "07:30", end: "08:50", room: "Ruang 9A" },
    { mapel: "Bahasa Indonesia",      rombel: "9A", day: 1, start: "09:00", end: "10:20", room: "Ruang 9A" },
    { mapel: "Ilmu Pengetahuan Alam", rombel: "9A", day: 2, start: "07:30", end: "08:50", room: "Lab IPA" },
    { mapel: "Bahasa Inggris",        rombel: "9B", day: 2, start: "09:00", end: "10:20", room: "Lab Bahasa" },
    { mapel: "Pendidikan Agama Islam",rombel: "9A", day: 3, start: "07:30", end: "08:50", room: "Ruang 9A" },
    { mapel: "Matematika",            rombel: "9B", day: 3, start: "09:00", end: "10:20", room: "Ruang 9B" },
    { mapel: "Bahasa Indonesia",      rombel: "9B", day: 4, start: "07:30", end: "08:50", room: "Ruang 9B" },
    { mapel: "Pendidikan Agama Islam",rombel: "9B", day: 5, start: "07:30", end: "08:50", room: "Ruang 9B" },
  ];

  for (const j of jadwalData) {
    const assignmentId = assignMap.get(`${j.mapel}|${j.rombel}`);
    if (!assignmentId) { console.log(`⚠ Skip jadwal ${j.mapel}×${j.rombel}: assignment tidak ditemukan`); continue; }
    await prisma.schedule.upsert({
      where: { assignmentId_day_startTime: { assignmentId, day: j.day, startTime: j.start } },
      create: { assignmentId, day: j.day, startTime: j.start, endTime: j.end, room: j.room },
      update: {},
    });
    const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][j.day];
    console.log(`✓ Jadwal ${j.mapel} ${j.rombel} ${hariNama} ${j.start}–${j.end}`);
  }

  // ── 9. Wali kelas 9A = guru MTK, wali kelas 9B = guru BIND ───────────────
  const wali9A = guruIds.get("Matematika")!;
  const wali9B = guruIds.get("Bahasa Indonesia")!;
  await prisma.class.update({ where: { id: rombelMap.get("9A")! }, data: { homeroomUserId: wali9A } });
  await prisma.class.update({ where: { id: rombelMap.get("9B")! }, data: { homeroomUserId: wali9B } });
  console.log(`✓ Wali kelas 9A: Budi Santoso | 9B: Siti Rahayu`);

  console.log("\n══════════════════════════════════════════════");
  console.log("✅ Seed demo selesai! Akun yang tersedia:\n");
  console.log("👤 ADMIN   : admin / P4nglim4!");
  console.log("\n📚 GURU (PIN: 123456):");
  guruData.forEach(g => console.log(`   ${g.username.padEnd(20)} — ${g.nama}`));
  console.log("\n🎓 SISWA (PIN: 123456, username = NISN):");
  siswaData.forEach(s => console.log(`   ${s.nisn.padEnd(20)} — ${s.nama} (${s.rombel})`));
  console.log("\n👨‍👩‍👦 ORANG TUA (PIN: 123456):");
  ortuData.forEach(o => console.log(`   ${o.username.padEnd(20)} — ${o.nama}`));
  console.log("══════════════════════════════════════════════\n");
}

main()
  .catch((e) => { console.error("❌ Seed gagal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
