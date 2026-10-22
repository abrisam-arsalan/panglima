"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { requireUser, logAudit } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";

async function guard() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Hanya admin yang berwenang");
  return u;
}

export async function createAssignment(formData: FormData) {
  const admin = await guard();
  const teacherUserId = toBigInt(formData.get("teacherUserId")) ?? BigInt(0);
  const subjectId = toBigInt(formData.get("subjectId")) ?? BigInt(0);
  const classId = toBigInt(formData.get("classId")) ?? BigInt(0);
  const ctx = await currentSemester();
  if (!ctx) redirect("/admin/penugasan?err=" + encodeURIComponent("Tahun ajaran aktif belum ditentukan"));
  if (!teacherUserId || !subjectId || !classId) redirect("/admin/penugasan?err=" + encodeURIComponent("Lengkapi guru, mata pelajaran, dan rombel"));

  const teacher = await prisma.user.findFirst({ where: { id: teacherUserId, role: "GURU" } });
  if (!teacher) redirect("/admin/penugasan?err=" + encodeURIComponent("Akun terpilih bukan berstatus GURU"));

  await prisma.assignment.upsert({
    where: { teacherId_subjectId_classId_semesterId: { teacherId: teacher.id, subjectId, classId, semesterId: ctx.semester.id } },
    create: { teacherId: teacher.id, subjectId, classId, semesterId: ctx.semester.id },
    update: {},
  });

  await logAudit({ userId: admin.id, action: "ASSIGN_BARU", entity: "assignments", entityId: `${teacherUserId}|${subjectId}|${classId}` });
  revalidatePath("/admin/penugasan");
  revalidatePath("/jadwal");
  redirect("/admin/penugasan?msg=" + encodeURIComponent("Penugasan baru berhasil dibuat"));
}

export async function deleteAssignment(formData: FormData) {
  const admin = await guard();
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const counts = await prisma.assignment.findUnique({
    where: { id },
    select: { _count: { select: { materials: true, tasks: true, learningTargets: true, schedules: true } } },
  });
  if (!counts) return;
  const c = counts._count;
  if (c.materials || c.tasks || c.learningTargets || c.schedules) {
    redirect(`/admin/penugasan?err=${encodeURIComponent(`Penugasan masih dipakai (materi=${c.materials}, tugas=${c.tasks}, TP=${c.learningTargets}, jam=${c.schedules})`)}`);
  }
  await prisma.assignment.delete({ where: { id } });
  await logAudit({ userId: admin.id, action: "ASSIGN_HAPUS", entity: "assignments", entityId: String(id) });
  revalidatePath("/admin/penugasan");
  revalidatePath("/jadwal");
  redirect("/admin/penugasan?msg=" + encodeURIComponent("Penugasan berhasil dihapus"));
}

export async function setHomeroom(formData: FormData) {
  const admin = await guard();
  const classId = toBigInt(formData.get("classId")) ?? BigInt(0);
  const userId = toBigInt(formData.get("homeroomUserId")) ?? null;
  if (!classId) return;
  await prisma.class.update({ where: { id: classId }, data: { homeroomUserId: userId } });
  await logAudit({ userId: admin.id, action: "WALI_SET", entity: "classes", entityId: String(classId), detail: { guru: userId?.toString() ?? null } });
  revalidatePath("/admin/penugasan");
  revalidatePath("/admin/akun/kelas");
  redirect("/admin/penugasan?msg=" + encodeURIComponent("Wali kelas berhasil diperbarui"));
}

export async function addSubject(formData: FormData) {
  const admin = await guard();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const code = String(formData.get("code") ?? "").trim().slice(0, 16) || "MAPEL";
  if (!name) redirect("/admin/penugasan?err=" + encodeURIComponent("Nama mata pelajaran wajib diisi"));
  await prisma.subject.upsert({ where: { name }, create: { name, code }, update: { code } });
  await logAudit({ userId: admin.id, action: "MAPEL_BARU", entity: "subjects", entityId: name });
  revalidatePath("/admin/penugasan");
  redirect("/admin/penugasan?msg=" + encodeURIComponent(`Mata pelajaran '${name}' berhasil disimpan`));
}
