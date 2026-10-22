"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdminSurface, logAudit, assertPinClear } from "@/lib/auth";
import { toBigInt, safePath } from "@/lib/safe";

async function guardAdmin() {
  const u = await requireAdminSurface("admin/users");
  assertPinClear(u);
  return u;
}
const back = (q = "") => { revalidatePath("/admin/users"); redirect(`/admin/users${q}`); };

const clean = (v: FormDataEntryValue | null, max = 120) =>
  String(v ?? "").trim().slice(0, max);

export async function addUser(formData: FormData) {
  const admin = await guardAdmin();
  const role = clean(formData.get("role"), 10).toUpperCase();
  const username = clean(formData.get("username"), 64);
  const nama = clean(formData.get("nama"), 120);
  // Tanpa password default: admin wajib isi eksplisit (min 6 char).
  const pass = clean(formData.get("password"), 72);
  if (pass.length < 6) back("?err=Password%20minimal%206%20karakter");
  if (!["ADMIN", "GURU", "SISWA", "ORTU", "KEPSEK"].includes(role) || !username || !nama)
    back("?err=Role%2C%20username%20dan%20nama%20wajib%20valid");

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) back("?err=Username%20sudah%20dipakai");

  const hash = await bcrypt.hash(pass, 10);
  const nisn = clean(formData.get("nisn"), 32) || null;
  const nip = clean(formData.get("nip"), 32) || null;
  const classId = toBigInt(clean(formData.get("classId"), 20));

  const u = await prisma.user.create({
    data: {
      username,
      nama,
      role: role as never,
      passwordHash: hash,
      nisn: nisn || null,
      nip: nip || null,
      classId: role === "SISWA" ? classId : null,
    },
  });

  // ortu → tauti anak lewat NISN anak
  if (role === "ORTU") {
    const anakNisn = clean(formData.get("anakNisn"), 32);
    if (anakNisn) {
      const anak = await prisma.user.findFirst({ where: { nisn: anakNisn, role: "SISWA" } });
      if (anak) {
        await prisma.parentLink.create({
          data: { parentId: u.id, childId: anak.id },
        });
      }
    }
  }

  await logAudit({ userId: admin.id, action: "USER_BARU", entity: "users", entityId: String(u.id), detail: { role, username } });
  back("");
}

export async function resetPassword(formData: FormData) {
  const admin = await guardAdmin();
  const id = toBigInt(clean(formData.get("id"), 20)) ?? BigInt(0);
  const pass = clean(formData.get("password"), 72);
  if (!id || pass.length < 6) back("?err=Password%20baru%20minimal%206%20karakter");
  const hash = await bcrypt.hash(pass, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  await logAudit({ userId: admin.id, action: "PASS_RESET", entity: "users", entityId: String(id) });
  back("");
}

export async function toggleActive(formData: FormData) {
  const admin = await guardAdmin();
  const id = toBigInt(clean(formData.get("id"), 20)) ?? BigInt(0);
  const u = await prisma.user.findUnique({ where: { id }, select: { isActive: true, username: true } });
  if (!u) return;
  await prisma.user.update({ where: { id }, data: { isActive: !u.isActive } });
  await logAudit({ userId: admin.id, action: u.isActive ? "USER_NONAKTIF" : "USER_AKTIF", entity: "users", entityId: String(id), detail: { username: u.username } });
  back("");
}

export async function editUser(formData: FormData) {
  const admin = await guardAdmin();
  const id = toBigInt(clean(formData.get("id"), 20)) ?? BigInt(0);
  const nama = clean(formData.get("nama"), 120);
  const nisn = clean(formData.get("nisn"), 32) || null;
  const nip = clean(formData.get("nip"), 32) || null;
  const classId = toBigInt(clean(formData.get("classId"), 20));
  if (!id || !nama) back("?err=Nama%20wajib%20diisi");

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return;

  await prisma.user.update({
    where: { id },
    data: {
      nama,
      ...(nisn !== null ? { nisn } : {}),
      ...(nip !== null ? { nip } : {}),
      ...(u.role === "SISWA" && classId ? { classId } : {}),
    },
  });

  await logAudit({ userId: admin.id, action: "USER_UBAH", entity: "users", entityId: String(id), detail: { lama: u.nama, baru: nama } });
  back("");
}
