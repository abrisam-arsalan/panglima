"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, logAudit } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";
import { planSiswa, planGuru, planJadwal, planOrtu, type ImportKind } from "@/lib/importer";
import { syncStudentsToCbt } from "@/lib/cbt-sync";

const IMPORT_DIR = path.resolve("storage/imports");

async function guard() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Hanya admin");
  return u;
}

export async function uploadPreview(formData: FormData) {
  await guard();
  const rawKind = String(formData.get("kind") ?? "");
  const kind: ImportKind = rawKind === "guru" ? "guru" : rawKind === "jadwal" ? "jadwal" : rawKind === "ortu" ? "ortu" : "siswa";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/admin/import?err=Kosong");
  if (file.size > 2 * 1024 * 1024) redirect("/admin/import?err=Maksimum+2MB");
  const text = (await file.text()).replace(/^﻿/, "");
  const { rows, problems } =
    kind === "siswa"
      ? planSiswa(text)
      : kind === "guru"
      ? planGuru(text)
      : kind === "ortu"
      ? planOrtu(text)
      : planJadwal(text);
  if (problems.length) redirect(`/admin/import?err=${encodeURIComponent(problems.join(" · "))}`);
  if (!rows.length) redirect("/admin/import?err=Tidak+ada+baris+data");

  await fs.mkdir(IMPORT_DIR, { recursive: true });
  const rev = crypto.randomBytes(8).toString("hex");
  await fs.writeFile(path.join(IMPORT_DIR, `${rev}.csv`), text);
  redirect(`/admin/import?rev=${rev}&kind=${kind}`);
}

export async function commitImport(formData: FormData) {
  const admin = await guard();
  const rev = String(formData.get("rev") ?? "").replace(/[^0-9a-f]/g, "").slice(0, 32);
  const rawKind = String(formData.get("kind") ?? "");
  const kind: ImportKind = rawKind === "guru" ? "guru" : rawKind === "jadwal" ? "jadwal" : rawKind === "ortu" ? "ortu" : "siswa";
  const tmpPass = String(formData.get("tmpPass") ?? "").trim() || "123456";
  const file = path.join(IMPORT_DIR, `${rev}.csv`);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    redirect("/admin/import?err=Sesi+preview+hilang+-+unggah+ulang");
  }

  const { rows } =
    kind === "siswa"
      ? planSiswa(text)
      : kind === "guru"
      ? planGuru(text)
      : kind === "ortu"
      ? planOrtu(text)
      : planJadwal(text);

  const ctx = await currentSemester();
  if (!ctx) redirect("/admin/import?err=Set+tahun+ajaran+aktif+dulu");

  const result: { created: number; skipped: number; existing: number; errors: string[]; rombelBaru: string[] } = {
    created: 0,
    skipped: 0,
    existing: 0,
    errors: [],
    rombelBaru: [],
  };

  const classCache = new Map<string, bigint>();
  const kelasAktif = await prisma.class.findMany({ where: { academicYearId: ctx.year.id }, select: { id: true, name: true } });
  for (const k of kelasAktif) classCache.set(k.name.toUpperCase(), k.id);

  if (kind === "jadwal") {
    // 1. Cache mapel
    const subjectCache = new Map<string, bigint>();
    const allSubjects = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
    for (const s of allSubjects) {
      subjectCache.set(s.name.toUpperCase(), s.id);
      subjectCache.set(s.code.toUpperCase(), s.id);
    }

    // 2. Cache guru
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
        result.errors.push(`baris ${r.line}: ${r.reason}`);
        continue;
      }

      // Resolve Class
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

      // Resolve Subject
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

      // Resolve Teacher
      const guruKey = r.guru!.trim().toUpperCase();
      let teacherId = teacherByNip.get(guruKey) ?? teacherByUsername.get(guruKey) ?? teacherByName.get(guruKey);
      if (!teacherId) {
        const matched = allTeachers.find((t) => t.nama.toUpperCase().includes(guruKey));
        if (matched) teacherId = matched.id;
      }

      if (!teacherId) {
        result.skipped++;
        result.errors.push(`baris ${r.line}: Guru '${r.guru}' tidak ditemukan. Buat akun guru terlebih dahulu.`);
        continue;
      }

      // Resolve Assignment
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

      // Create or detect existing schedule
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

    await logAudit({
      userId: admin.id,
      action: "IMPORT_CSV",
      entity: "schedules",
      entityId: rev,
      detail: { kind, ...result },
    });
    await fs.rm(file, { force: true });
    await fs.writeFile(path.join(IMPORT_DIR, `${rev}.done.json`), JSON.stringify(result));
    revalidatePath("/jadwal");
    revalidatePath("/admin/master");
    redirect(`/admin/import?done=${rev}&kind=jadwal`);
  }

  // Siswa / Guru flow
  const hash = await bcrypt.hash(tmpPass, 10);

  for (const r of rows) {
    if (r.status === "ERR") {
      result.skipped++;
      result.errors.push(`baris ${r.line}: ${r.reason}`);
      continue;
    }

    if (kind === "ortu") {
      const student = await prisma.user.findFirst({
        where: { nisn: r.anakNisn!, role: "SISWA" },
        select: { id: true, nama: true },
      });
      if (!student) {
        result.skipped++;
        result.errors.push(`baris ${r.line}: Siswa dengan NISN '${r.anakNisn}' tidak ditemukan.`);
        continue;
      }

      let parentUser = await prisma.user.findUnique({ where: { username: r.username } });
      if (!parentUser) {
        parentUser = await prisma.user.create({
          data: {
            username: r.username,
            nama: r.nama,
            role: "ORTU",
            passwordHash: hash,
            mustChangePin: true,
          },
        });
        result.created++;
      } else {
        result.existing++;
      }

      const rel = (r.hubungan === "AYAH" || r.hubungan === "IBU" || r.hubungan === "WALI") ? r.hubungan : "WALI";
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
      await prisma.user.create({
        data: {
          username: r.username,
          nama: r.nama,
          role: "GURU",
          passwordHash: hash,
          nip: r.nip || null,
          mustChangePin: true,
        },
      });
      result.created++;
    } else {
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

      const plainPin = r.pin?.trim() || tmpPass;
      const studentPasswordHash = r.pin?.trim() ? await bcrypt.hash(plainPin, 10) : hash;

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
          username: r.username, // NISN sekaligus Username
          nama: r.nama,
          role: "SISWA",
          passwordHash: studentPasswordHash,
          pinCipher: plainPin, // Plain PIN disimpan agar di-sync ke CBT
          nisn: r.nisn || null,
          classId,
          mustChangePin: false,
        },
      });
      result.created++;
    }
  }

  // Jika impor siswa, otomatis sinkronkan data siswa ke database aplikasi ujian (CBT)
  if (kind === "siswa") {
    try {
      await syncStudentsToCbt();
    } catch (syncErr) {
      console.error("Auto sync to CBT error:", syncErr);
    }
  }

  await logAudit({
    userId: admin.id,
    action: "IMPORT_CSV",
    entity: "users",
    entityId: rev,
    detail: { kind, ...result, created: result.created },
  });
  await fs.rm(file, { force: true });
  await fs.writeFile(path.join(IMPORT_DIR, `${rev}.done.json`), JSON.stringify(result));
  revalidatePath("/admin/users");
  revalidatePath("/admin/ujian");
  redirect(`/admin/import?done=${rev}&kind=${kind}`);
}

/** Aksi manual sinkronisasi siswa ke CBT */
export async function syncCbtStudentsAction() {
  await guard();
  const res = await syncStudentsToCbt();
  revalidatePath("/admin/ujian");
  revalidatePath("/admin/users");
  revalidatePath("/admin/import");
  return res;
}
