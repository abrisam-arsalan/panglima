"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdminSurface, logAudit } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";
import { planSiswa, planGuru, planOrtu, planKelas, planJadwal, type ImportKind } from "@/lib/importer";
import { syncStudentsToCbt } from "@/lib/cbt-sync";
import { toBigInt, safePath } from "@/lib/safe";

/**
 * Generate 6 digit random PIN numerik, hindari kombinasi mudah ditebak.
 */
function generateRandomPin(): string {
  const banned = new Set(["123456", "654321", "000000", "111111", "012345", "123123"]);
  for (let i = 0; i < 20; i++) {
    const pin = crypto.randomInt(100000, 1000000).toString();
    if (!banned.has(pin)) return pin;
  }
  return crypto.randomInt(100000, 1000000).toString();
}

async function guard(area = "admin/akun") {
  return requireAdminSurface(area);
}

/**
 * Bulk Upload CSV untuk Kelas, Siswa, Guru, Ortu, dan Jadwal
 */
export async function importBulkAction(formData: FormData) {
  const admin = await guard();
  const rawKind = String(formData.get("kind") ?? "");
  const kind: ImportKind =
    rawKind === "guru" ? "guru"
    : rawKind === "ortu" ? "ortu"
    : rawKind === "kelas" ? "kelas"
    : rawKind === "jadwal" ? "jadwal"
    : "siswa";

  const redirectUrl = safePath(formData.get("redirectUrl"), `/admin/akun/${kind}`);
  const tmpPass = String(formData.get("tmpPass") ?? "").trim() || generateRandomPin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${redirectUrl}?err=${encodeURIComponent("Berkas CSV tidak boleh kosong")}`);
  }
  if (file.size > 5 * 1024 * 1024) {
    redirect(`${redirectUrl}?err=${encodeURIComponent("Ukuran file maksimum 5MB")}`);
  }

  const text = (await file.text()).replace(/^\uFEFF/, "");
  const { rows, problems } =
    kind === "kelas" ? planKelas(text)
    : kind === "guru" ? planGuru(text)
    : kind === "ortu" ? planOrtu(text)
    : kind === "jadwal" ? planJadwal(text)
    : planSiswa(text);

  if (problems.length) {
    redirect(`${redirectUrl}?err=${encodeURIComponent(problems.join(" · "))}`);
  }
  if (!rows.length) {
    redirect(`${redirectUrl}?err=${encodeURIComponent("Tidak ada baris data yang ditemukan dalam berkas")}`);
  }

  const ctx = await currentSemester();
  if (!ctx) {
    redirect(`${redirectUrl}?err=${encodeURIComponent("Tahun ajaran aktif belum ditentukan")}`);
  }

  const result = {
    created: 0,
    skipped: 0,
    existing: 0,
    errors: [] as string[],
    rombelBaru: [] as string[],
  };

  const classCache = new Map<string, bigint>();
  const kelasAktif = await prisma.class.findMany({
    where: { academicYearId: ctx.year.id },
    select: { id: true, name: true },
  });
  for (const k of kelasAktif) classCache.set(k.name.toUpperCase(), k.id);

  // ── 1. BULK KELAS ──
  if (kind === "kelas") {
    for (const r of rows) {
      if (r.status === "ERR") {
        result.skipped++;
        result.errors.push(`Baris ${r.line}: ${r.reason}`);
        continue;
      }
      const existingId = classCache.get(r.rombel!.toUpperCase());
      const tingkat = Number(r.kelas ?? 7);

      if (existingId !== undefined) {
        result.existing++;
        continue;
      }

      const created = await prisma.class.create({
        data: {
          name: r.rombel!,
          tingkat,
          academicYearId: ctx.year.id,
          description: r.ruang || null,
        },
      });
      classCache.set(created.name.toUpperCase(), created.id);
      result.created++;

      // Sinkronkan ke cbt_tka.classes
      try {
        await prisma.$queryRawUnsafe(`
          INSERT INTO cbt_tka.classes (name, grade, academic_year, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 1, NOW(), NOW())
          ON DUPLICATE KEY UPDATE grade = VALUES(grade), is_active = 1, updated_at = NOW()
        `, r.rombel!, String(tingkat), ctx.year.name || "2026/2027");
      } catch (cbtErr) {
        console.warn("Gagal auto-sync class ke CBT:", cbtErr);
      }
    }
  }

  // ── 2. BULK JADWAL ──
  else if (kind === "jadwal") {
    const subjectCache = new Map<string, bigint>();
    const allSubjects = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
    for (const s of allSubjects) {
      subjectCache.set(s.name.toUpperCase(), s.id);
      subjectCache.set(s.code.toUpperCase(), s.id);
    }

    const allTeachers = await prisma.user.findMany({
      where: { role: "GURU", isActive: true, deletedAt: null },
      select: { id: true, nip: true, username: true, nama: true },
    });
    const teacherByNip = new Map<string, bigint>();
    const teacherByUsername = new Map<string, bigint>();
    const teacherByName = new Map<string, bigint>();
    for (const t of allTeachers) {
      if (t.nip) teacherByNip.set(t.nip.trim().toUpperCase(), t.id);
      teacherByUsername.set(t.username.trim().toUpperCase(), t.id);
      teacherByName.set(t.nama.trim().toUpperCase(), t.id);
    }

    for (const r of rows) {
      if (r.status === "ERR") {
        result.skipped++;
        result.errors.push(`Baris ${r.line}: ${r.reason}`);
        continue;
      }

      let classId = classCache.get(r.rombel!.toUpperCase());
      if (classId === undefined) {
        const tingkat = Number(r.rombel!.match(/^\d/)?.[0] ?? 7);
        const createdClass = await prisma.class.create({
          data: { name: r.rombel!, tingkat, academicYearId: ctx.year.id },
          select: { id: true, name: true },
        });
        classCache.set(createdClass.name.toUpperCase(), createdClass.id);
        classId = createdClass.id;
        result.rombelBaru.push(r.rombel!);
      }

      const mapelUpper = r.mapel!.trim().toUpperCase();
      let subjectId = subjectCache.get(mapelUpper);
      if (subjectId === undefined) {
        const code = r.mapel!.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, "") || "MAPEL";
        const createdSubject = await prisma.subject.create({
          data: { name: r.mapel!.trim(), code },
          select: { id: true, name: true, code: true },
        });
        subjectCache.set(createdSubject.name.toUpperCase(), createdSubject.id);
        subjectCache.set(createdSubject.code.toUpperCase(), createdSubject.id);
        subjectId = createdSubject.id;
      }

      const guruKey = r.guru!.trim().toUpperCase();
      let teacherId = teacherByNip.get(guruKey) ?? teacherByUsername.get(guruKey) ?? teacherByName.get(guruKey);
      if (!teacherId) {
        const matched = allTeachers.find((t) => t.nama.toUpperCase().includes(guruKey));
        if (matched) teacherId = matched.id;
      }

      if (!teacherId) {
        result.skipped++;
        result.errors.push(`Baris ${r.line}: Guru '${r.guru}' tidak ditemukan.`);
        continue;
      }

      const assignment = await prisma.assignment.upsert({
        where: {
          teacherId_subjectId_classId_semesterId: {
            teacherId,
            subjectId,
            classId,
            semesterId: ctx.semester.id,
          },
        },
        create: {
          teacherId,
          subjectId,
          classId,
          semesterId: ctx.semester.id,
        },
        update: {},
      });

      const existSchedule = await prisma.schedule.findUnique({
        where: {
          assignmentId_day_startTime: {
            assignmentId: assignment.id,
            day: r.hari!,
            startTime: r.startTime!,
          },
        },
      });

      if (existSchedule) {
        result.existing++;
      } else {
        await prisma.schedule.create({
          data: {
            assignmentId: assignment.id,
            day: r.hari!,
            startTime: r.startTime!,
            endTime: r.endTime!,
            room: r.ruang || null,
          },
        });
        result.created++;
      }
    }
  }

  // ── 3. BULK SISWA / GURU / ORTU ──
  else {
    for (const r of rows) {
      if (r.status === "ERR") {
        result.skipped++;
        result.errors.push(`Baris ${r.line}: ${r.reason}`);
        continue;
      }

      if (kind === "ortu") {
        const student = await prisma.user.findFirst({
          where: { nisn: r.anakNisn!, role: "SISWA" },
          select: { id: true, nama: true },
        });
        if (!student) {
          result.skipped++;
          result.errors.push(`Baris ${r.line}: Siswa dengan NISN '${r.anakNisn}' tidak ditemukan.`);
          continue;
        }

        let parentUser = await prisma.user.findUnique({ where: { username: r.username } });
        if (!parentUser) {
          const plainPin = generateRandomPin();
          const parentHash = await bcrypt.hash(plainPin, 10);
          parentUser = await prisma.user.create({
            data: {
              username: r.username,
              nama: r.nama,
              role: "ORTU",
              passwordHash: parentHash,
              pinCipher: plainPin,
              mustChangePin: false,
            },
          });
          result.created++;
        } else {
          result.existing++;
        }

        const rel = r.hubungan === "AYAH" || r.hubungan === "IBU" || r.hubungan === "WALI" ? r.hubungan : "WALI";
        await prisma.parentLink.upsert({
          where: { parentId: parentUser.id },
          create: { parentId: parentUser.id, childId: student.id, hubungan: rel },
          update: { childId: student.id, hubungan: rel },
        });
        continue;
      }

      const exist = await prisma.user.findUnique({ where: { username: r.username }, select: { id: true, nama: true } });

      if (kind === "guru") {
        if (exist) {
          result.existing++;
          continue;
        }
        const plainPin = generateRandomPin();
        const teacherHash = await bcrypt.hash(plainPin, 10);
        await prisma.user.create({
          data: {
            username: r.username,
            nama: r.nama,
            role: "GURU",
            passwordHash: teacherHash,
            pinCipher: plainPin,
            nip: r.nip || null,
            mustChangePin: false,
          },
        });
        result.created++;
      } else {
        // SISWA
        let classId: bigint | undefined = classCache.get(r.rombel!.toUpperCase());
        if (classId === undefined) {
          const parsedTingkat = r.kelas ? Number(r.kelas.replace(/\D/g, "")) : NaN;
          const tingkat = !isNaN(parsedTingkat) && parsedTingkat > 0
            ? parsedTingkat
            : Number(r.rombel!.match(/\d+/)?.[0] ?? 7);

          const created = await prisma.class.create({
            data: { name: r.rombel!, tingkat, academicYearId: ctx.year.id },
            select: { id: true, name: true },
          });
          classCache.set(created.name.toUpperCase(), created.id);
          classId = created.id;
          result.rombelBaru.push(r.rombel!);
        }

        const plainPin = r.pin?.trim() ? r.pin.trim() : generateRandomPin();
        const studentPasswordHash = await bcrypt.hash(plainPin, 10);

        if (exist) {
          await prisma.user.update({
            where: { id: exist.id },
            data: {
              nama: r.nama,
              nisn: r.nisn || null,
              classId,
              ...(r.pin?.trim() ? { passwordHash: studentPasswordHash, pinCipher: plainPin } : {}),
            },
          });
          result.existing++;
          continue;
        }

        await prisma.user.create({
          data: {
            username: r.username,
            nama: r.nama,
            role: "SISWA",
            passwordHash: studentPasswordHash,
            pinCipher: plainPin,
            nisn: r.nisn || null,
            classId,
            mustChangePin: false,
          },
        });
        result.created++;
      }
    }

    if (kind === "siswa") {
      try {
        await syncStudentsToCbt();
      } catch (syncErr) {
        console.error("Auto sync to CBT error:", syncErr);
      }
    }
  }

  await logAudit({
    userId: admin.id,
    action: "IMPORT_BULK",
    entity: kind,
    detail: { ...result, totalRows: rows.length },
  });

  revalidatePath(redirectUrl);
  revalidatePath("/admin/akun/kelas");
  revalidatePath("/admin/akun/siswa");
  revalidatePath("/admin/akun/guru");
  revalidatePath("/admin/akun/ortu");
  revalidatePath("/admin/ujian");
  revalidatePath("/jadwal");

  const successQuery = `done=1&created=${result.created}&existing=${result.existing}&skipped=${result.skipped}`;
  redirect(`${redirectUrl}?${successQuery}`);
}

/**
 * Tambah Akun Siswa Manual
 */
export async function addStudentAction(formData: FormData) {
  const admin = await guard();
  const nama = String(formData.get("nama") ?? "").trim();
  const nisn = String(formData.get("nisn") ?? "").trim().replace(/\D/g, "");
  const classIdRaw = String(formData.get("classId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim() || generateRandomPin();

  if (!nama || !nisn) {
    redirect(`/admin/akun/siswa?err=${encodeURIComponent("Nama dan NISN wajib diisi")}`);
  }

  const existing = await prisma.user.findUnique({ where: { username: nisn } });
  if (existing) {
    redirect(`/admin/akun/siswa?err=${encodeURIComponent(`Siswa dengan NISN '${nisn}' sudah terdaftar`)}`);
  }

  const classId = classIdRaw ? BigInt(classIdRaw) : null;
  const passwordHash = await bcrypt.hash(pin, 10);

  await prisma.user.create({
    data: {
      username: nisn,
      nama,
      role: "SISWA",
      nisn,
      classId,
      passwordHash,
      pinCipher: pin,
      mustChangePin: false,
    },
  });

  try {
    await syncStudentsToCbt();
  } catch (syncErr) {
    console.error("Auto sync to CBT error:", syncErr);
  }

  await logAudit({ userId: admin.id, action: "SISWA_TAMBAH", entity: "users", entityId: nisn });
  revalidatePath("/admin/akun/siswa");
  redirect(`/admin/akun/siswa?msg=${encodeURIComponent(`Siswa ${nama} berhasil ditambahkan`)}`);
}

/**
 * Tambah Akun Guru Manual
 */
export async function addTeacherAction(formData: FormData) {
  const admin = await guard();
  const nama = String(formData.get("nama") ?? "").trim();
  const nip = String(formData.get("nip") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim() || nip;
  const password = String(formData.get("password") ?? "").trim() || generateRandomPin();

  if (!nama || !username) {
    redirect(`/admin/akun/guru?err=${encodeURIComponent("Nama dan Username/NIP wajib diisi")}`);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    redirect(`/admin/akun/guru?err=${encodeURIComponent(`Guru dengan username '${username}' sudah terdaftar`)}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username,
      nama,
      role: "GURU",
      nip: nip || null,
      passwordHash,
      pinCipher: password,
      mustChangePin: false,
    },
  });

  await logAudit({ userId: admin.id, action: "GURU_TAMBAH", entity: "users", entityId: username });
  revalidatePath("/admin/akun/guru");
  redirect(`/admin/akun/guru?msg=${encodeURIComponent(`Guru ${nama} berhasil ditambahkan`)}`);
}

/**
 * Tambah Akun Orang Tua Manual
 */
export async function addParentAction(formData: FormData) {
  const admin = await guard();
  const nama = String(formData.get("nama") ?? "").trim();
  const anakNisn = String(formData.get("anakNisn") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim() || (anakNisn ? `P${anakNisn}` : "");
  const hubunganRaw = String(formData.get("hubungan") ?? "WALI");
  const hubungan = hubunganRaw === "AYAH" || hubunganRaw === "IBU" || hubunganRaw === "WALI" ? hubunganRaw : "WALI";
  const password = String(formData.get("password") ?? "").trim() || generateRandomPin();

  if (!nama || !username || !anakNisn) {
    redirect(`/admin/akun/ortu?err=${encodeURIComponent("Nama, Username, dan NISN Anak wajib diisi")}`);
  }

  const student = await prisma.user.findFirst({
    where: { nisn: anakNisn, role: "SISWA" },
    select: { id: true },
  });
  if (!student) {
    redirect(`/admin/akun/ortu?err=${encodeURIComponent(`Siswa dengan NISN '${anakNisn}' tidak ditemukan`)}`);
  }

  let parent = await prisma.user.findUnique({ where: { username } });
  if (!parent) {
    const passwordHash = await bcrypt.hash(password, 10);
    parent = await prisma.user.create({
      data: {
        username,
        nama,
        role: "ORTU",
        passwordHash,
        pinCipher: password,
        mustChangePin: false,
      },
    });
  }

  await prisma.parentLink.upsert({
    where: { parentId: parent.id },
    create: { parentId: parent.id, childId: student.id, hubungan },
    update: { childId: student.id, hubungan },
  });

  await logAudit({ userId: admin.id, action: "ORTU_TAMBAH", entity: "users", entityId: username });
  revalidatePath("/admin/akun/ortu");
  redirect(`/admin/akun/ortu?msg=${encodeURIComponent(`Akun orang tua ${nama} berhasil dihubungkan`)}`);
}

/**
 * Tambah Kelas & Rombel Manual
 */
export async function addClassAction(formData: FormData) {
  const admin = await guard();
  const name = String(formData.get("name") ?? "").trim().slice(0, 16).toUpperCase();
  const tingkatRaw = Number(String(formData.get("tingkat") ?? "").trim());
  const description = String(formData.get("description") ?? "").trim() || null;

  const ctx = await currentSemester();
  if (!ctx) redirect("/admin/akun/kelas?err=Set+tahun+ajaran+aktif+dulu");

  const m = name.match(/^(\d)/);
  const tingkat = !isNaN(tingkatRaw) && tingkatRaw > 0 ? tingkatRaw : (m ? Number(m[1]) : 7);

  if (!name) redirect("/admin/akun/kelas?err=Nama+rombel+wajib+diisi");

  await prisma.class.upsert({
    where: { name_academicYearId: { name, academicYearId: ctx.year.id } },
    create: { name, tingkat, academicYearId: ctx.year.id, description },
    update: { tingkat, description },
  });

  // Auto sync to CBT
  try {
    await prisma.$queryRawUnsafe(`
      INSERT INTO cbt_tka.classes (name, grade, academic_year, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE grade = VALUES(grade), is_active = 1, updated_at = NOW()
    `, name, String(tingkat), ctx.year.name || "2026/2027");
  } catch (syncErr) {
    console.error("Auto sync class to CBT error:", syncErr);
  }

  await logAudit({ userId: admin.id, action: "ROMBEL_BARU", entity: "classes", entityId: name });
  revalidatePath("/admin/akun/kelas");
  redirect(`/admin/akun/kelas?msg=${encodeURIComponent(`Kelas ${name} berhasil disimpan`)}`);
}

/**
 * Hapus Kelas
 */
export async function deleteClassAction(formData: FormData) {
  const admin = await guard();
  const classId = toBigInt(formData.get("classId"));
  if (!classId) return;

  const countStudents = await prisma.user.count({ where: { classId, role: "SISWA" } });
  if (countStudents > 0) {
    redirect(`/admin/akun/kelas?err=${encodeURIComponent(`Kelas masih memiliki ${countStudents} siswa. Pindahkan siswa terlebih dahulu.`)}`);
  }

  await prisma.class.delete({ where: { id: classId } }).catch(() => {});
  await logAudit({ userId: admin.id, action: "ROMBEL_HAPUS", entity: "classes", entityId: String(classId) });
  revalidatePath("/admin/akun/kelas");
  redirect("/admin/akun/kelas?msg=Kelas+berhasil+dihapus");
}

/**
 * Reset Password / PIN User
 */
export async function resetPasswordAction(formData: FormData) {
  const admin = await guard();
  const userId = toBigInt(formData.get("userId"));
  if (!userId) throw new Error("ID pengguna tidak valid");
  const rawPin = String(formData.get("newPin") ?? "").trim();
  // PIN: 6 digit angka BUKAN urutan/kembar umum; kosong = acak.
  const newPin = rawPin || generateRandomPin();
  if (!/^\d{6}$/.test(newPin) || /^(123456|654321|000000|111111|012345|123123)$/.test(newPin)) {
    throw new Error("PIN harus 6 digit dan bukan kombinasi mudah ditebak");
  }
  const back = safePath(formData.get("redirectUrl"), "/admin/akun/siswa");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const hash = await bcrypt.hash(newPin, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash, pinCipher: newPin, mustChangePin: false },
  });

  if (user.role === "SISWA") {
    try {
      await syncStudentsToCbt();
    } catch (e) {
      console.error(e);
    }
  }

  // PIN BARU TIDAK dimasukkan ke URL (bocor di riwayat/log) — tampil sekali
  // via halaman khusus sekali-lihat di bawah (pinShow), kedaluwarsa 5 menit.
  const { issuePinShow } = await import("@/lib/pin-show");
  const token = await issuePinShow(admin.id, userId, newPin);
  await logAudit({ userId: admin.id, action: "RESET_PIN", entity: "users", entityId: String(userId) });
  revalidatePath(back);
  redirect(`${back}?pinShow=${token}`);
}

/**
 * Toggle Status Aktif User
 */
export async function toggleActiveAction(formData: FormData) {
  const admin = await guard();
  const userId = toBigInt(formData.get("userId")); if (!userId) throw new Error("ID pengguna tidak valid");
  const redirectUrl = safePath(formData.get("redirectUrl"), "/admin/akun/siswa");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  if (user.role === "SISWA") {
    try {
      await syncStudentsToCbt();
    } catch (e) {
      console.error(e);
    }
  }

  await logAudit({ userId: admin.id, action: "TOGGLE_AKTIF", entity: "users", entityId: String(userId) });
  revalidatePath(redirectUrl);
  redirect(`${redirectUrl}?msg=${encodeURIComponent(`Status akun ${user.nama} diubah menjadi ${updated.isActive ? "Aktif" : "Nonaktif"}`)}`);
}
