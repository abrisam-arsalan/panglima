"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";
import { canManageAssignment } from "@/lib/academic";
import { notifyClass, createNotification } from "@/lib/notify";
import { saveFile, removeStored } from "@/lib/storage";

async function guardManage(assignmentIdRaw: string | null) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user) redirect("/login");
  const assignmentId = BigInt(assignmentIdRaw ?? "0");
  if (!assignmentId || !(await canManageAssignment(user, assignmentId))) {
    throw new Error("Aksi ditolak");
  }
  return { user, assignmentId };
}

const dt = (v: FormDataEntryValue | null) => (v && String(v) ? new Date(String(v)) : null);

/** TP harus milik assignment yang sama — cegah taut silang assignment. */
async function resolveTp(assignmentId: bigint, raw: FormDataEntryValue | null): Promise<bigint | null> {
  const s = String(raw ?? "").trim();
  if (!s || !/^\d+$/.test(s)) return null;
  const tp = await prisma.learningTarget.findFirst({
    where: { id: BigInt(s), assignmentId },
    select: { id: true },
  });
  return tp?.id ?? null;
}

export async function createTask(formData: FormData) {
  const { user, assignmentId } = await guardManage(String(formData.get("assignmentId") ?? null));
  const judul = String(formData.get("judul") ?? "").trim().slice(0, 200);
  if (!judul) redirect(`/tugas?a=${assignmentId}`);
  const tipe = ["FILE", "TEKS", "CENTANG"].includes(String(formData.get("tipe")))
    ? String(formData.get("tipe")) : "FILE";
  const due = dt(formData.get("dueAt")) ?? new Date(Date.now() + 7 * 86_400_000);
  const lateUntil = dt(formData.get("lateUntil"));
  if (lateUntil && lateUntil < due) {
    redirect(`/tugas?a=${assignmentId}&err=${encodeURIComponent("Toleransi harus setelah tenggat")}`);
  }
  const instruksi = String(formData.get("instruksi") ?? "").slice(0, 20000);
  const tpId = await resolveTp(assignmentId, formData.get("tpId"));
  const t = await prisma.task.create({
    data: {
      assignmentId,
      judul,
      instruksi,
      tipe: tipe as "FILE" | "TEKS" | "CENTANG",
      tpId,
      dueAt: due,
      lateUntil: dt(formData.get("lateUntil")),
      status: formData.get("status") === "TERBIT" ? "TERBIT" : "DRAF",
      publishAt: formData.get("status") === "TERBIT" ? new Date() : null,
      createdById: user.id,
    },
  });
  await logAudit({ userId: user.id, action: "TUGAS_BARU", entity: "tasks", entityId: String(t.id) });
  if (t.status === "TERBIT") await notifyTask(t.id);
  revalidatePath("/tugas");
  redirect(`/tugas?a=${assignmentId}`);
}

export async function updateTask(formData: FormData) {
  const { user, assignmentId } = await guardManage(String(formData.get("assignmentId") ?? null));
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const lama = await prisma.task.findFirst({ where: { id, assignmentId, deletedAt: null } });
  if (!lama) throw new Error("Tugas tidak ditemukan");
  const judul = String(formData.get("judul") ?? "").trim().slice(0, 200) || lama.judul;
  const tipeRaw = String(formData.get("tipe") ?? lama.tipe);
  const tipe = (["FILE", "TEKS", "CENTANG"].includes(tipeRaw) ? tipeRaw : lama.tipe) as "FILE" | "TEKS" | "CENTANG";
  const status = formData.get("status") === "TERBIT" ? "TERBIT" : "DRAF";
  const due = dt(formData.get("dueAt")) ?? lama.dueAt;
  const lateUntil = dt(formData.get("lateUntil"));
  if (lateUntil && lateUntil < due) {
    redirect(`/tugas?a=${assignmentId}&err=${encodeURIComponent("Toleransi harus setelah tenggat")}`);
  }
  await prisma.task.update({
    where: { id },
    data: {
      judul,
      instruksi: String(formData.get("instruksi") ?? lama.instruksi).slice(0, 20000),
      tipe,
      tpId: await resolveTp(assignmentId, formData.get("tpId")),
      dueAt: due,
      lateUntil,
      status,
      publishAt: status === "TERBIT" && !lama.publishAt ? new Date() : lama.publishAt,
    },
  });
  if (status === "TERBIT" && lama.status === "DRAF") await notifyTask(id);
  revalidatePath("/tugas");
  redirect(`/tugas?a=${assignmentId}`);
}

async function notifyTask(taskId: bigint) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignment: { include: { subject: true, class: true } } },
  });
  if (!t) return;
  const due = t.dueAt
    ? ` — tenggat ${t.dueAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
    : "";
  await notifyClass(
    t.assignment.classId,
    "tugas_baru",
    `📝 Tugas baru: ${t.judul} (${t.assignment.class.name} · ${t.assignment.subject.name})${due}`,
    "/tugas",
  );
}

export async function deleteTask(formData: FormData) {
  const { user, assignmentId } = await guardManage(String(formData.get("assignmentId") ?? null));
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  await prisma.task.updateMany({ where: { id, assignmentId }, data: { deletedAt: new Date() } });
  await logAudit({ userId: user.id, action: "TUGAS_HAPUS", entity: "tasks", entityId: String(id) });
  revalidatePath("/tugas");
}

export async function uploadTaskFile(formData: FormData) {
  const taskId = toBigInt(formData.get("taskId")) ?? BigInt(0);
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t) throw new Error("Tugas tidak ada");
  await guardManage(String(t.assignmentId));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/tugas?t=${taskId}`);
  if (file.size > 20 * 1024 * 1024) redirect(`/tugas?t=${taskId}&err=maks20mb`);

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await saveFile(bytes, file.name);
  await prisma.taskFile.create({
    data: {
      taskId,
      nama: file.name.slice(0, 255),
      storedName: stored.storedName,
      mime: file.type || "application/octet-stream",
      sizeBytes: BigInt(file.size),
    },
  });
  revalidatePath(`/tugas`);
  redirect(`/tugas?t=${taskId}`);
}

export async function deleteTaskFile(formData: FormData) {
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const f = await prisma.taskFile.findUnique({ where: { id }, include: { task: true } });
  if (!f) return;
  await guardManage(String(f.task.assignmentId));
  await prisma.taskFile.delete({ where: { id } });
  await removeStored(f.storedName);
  revalidatePath("/tugas");
}

export async function submitTask(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || user.role !== "SISWA") throw new Error("Hanya siswa yang dapat mengumpulkan");
  const taskId = toBigInt(formData.get("taskId")) ?? BigInt(0);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignment: { include: { class: true } }, submissions: { where: { studentId: user.id } } },
  });
  if (!task || task.status !== "TERBIT" || task.deletedAt) throw new Error("Tugas tidak tersedia");

  if (user.classId !== task.assignment.classId) throw new Error("Tugas bukan dari kelasmu");

  const now = new Date();
  if (task.dueAt && now > (task.lateUntil ?? task.dueAt)) {
    redirect(`/tugas?t=${taskId}&err=lewat`);
  }
  const lama = task.submissions[0];
  if (lama && task.dueAt && now > task.dueAt) {
    redirect(`/tugas?t=${taskId}&err=kunci`);
  }

  const teks = String(formData.get("text") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (task.tipe === "FILE" && files.length === 0 && !lama) redirect(`/tugas?t=${taskId}&err=berkas`);
  if (task.tipe === "TEKS" && !teks) redirect(`/tugas?t=${taskId}&err=teks`);
  if (files.length > 3) throw new Error("Maksimal 3 berkas");

  const status = task.dueAt && now > task.dueAt ? "LATE" : "ONTIME";
  const sub =
    lama ??
    (await prisma.submission.create({ data: { taskId, studentId: user.id, text: teks || null, status } }));
  if (lama) {
    await prisma.submission.update({
      where: { id: lama.id },
      data: { text: teks || lama.text, status, revisiCount: { increment: 1 }, updatedAt: now },
    });
    if (task.tipe === "FILE" && files.length > 0) {
      const oldFiles = await prisma.submissionFile.findMany({ where: { submissionId: lama.id } });
      await prisma.submissionFile.deleteMany({ where: { submissionId: lama.id } });
      for (const of_ of oldFiles) await removeStored(of_.storedName);
    }
  }

  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const stored = await saveFile(bytes, f.name);
    await prisma.submissionFile.create({
      data: {
        submissionId: sub.id,
        nama: f.name.slice(0, 255),
        storedName: stored.storedName,
        mime: f.type || "application/octet-stream",
        sizeBytes: BigInt(f.size),
      },
    });
  }

  await logAudit({ userId: user.id, action: "TUGAS_SUBMIT", entity: "submissions", entityId: String(sub.id) });
  revalidatePath("/tugas");
  redirect(`/tugas?t=${taskId}&ok=1`);
}

export async function markCompletedByTeacher(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user) redirect("/login");
  const taskId = toBigInt(formData.get("taskId")) ?? BigInt(0);
  const studentId = toBigInt(formData.get("studentId")) ?? BigInt(0);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignment: true },
  });
  if (!task) throw new Error("Tugas tidak ada");
  await guardManage(String(task.assignmentId));

  const now = new Date();
  await prisma.submission.upsert({
    where: { taskId_studentId: { taskId, studentId } },
    create: {
      taskId, studentId, text: "Ditandai selesai oleh guru",
      status: task.dueAt && now > task.dueAt ? "LATE" : "ONTIME",
    },
    update: {},
  });
  await logAudit({ userId: user.id, action: "TUGAS_TANDAI", entity: "submissions", entityId: `${taskId}:${studentId}` });
  await createNotification(studentId, "tugas_selesai", `📝 ${task.judul} ditandai selesai oleh guru — tunggu nilai`, `/tugas?t=${taskId}`);
  revalidatePath("/tugas");
  redirect(`/tugas?t=${taskId}`);
}

export async function gradeSubmission(formData: FormData) {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user) redirect("/login");
  const submissionId = toBigInt(formData.get("submissionId")) ?? BigInt(0);
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { task: { include: { assignment: true } } },
  });
  if (!sub) throw new Error("Pengumpulan tidak ditemukan");
  const own = sub.task.assignment.teacherId === user.id || user.role === "ADMIN";
  if (!own) throw new Error("Bukan tugasmu");

  const raw = String(formData.get("score") ?? "").trim();
  const score = Number(raw);
  if (raw === "" || Number.isNaN(score) || score < 0 || score > 100) {
    redirect(`/tugas?t=${sub.taskId}&err=nilai`);
  }
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  const lama = await prisma.grade.findUnique({ where: { submissionId } });
  await prisma.grade.upsert({
    where: { submissionId },
    create: {
      target: "TUGAS", submissionId, studentId: sub.studentId,
      score, feedback, gradedById: user.id,
    },
    update: { score, feedback, gradedAt: new Date() },
  });
  await logAudit({
    userId: user.id, action: "NILAI_SIMPAN", entity: "grades", entityId: String(sub.taskId),
    detail: { lama: lama ? Number(lama.score) : null, baru: score, siswa: String(sub.studentId) },
  });
  const msg = `🎯 Nilai keluar: ${sub.task.judul} — ${score}`;
  await createNotification(sub.studentId, "nilai_keluar", msg, `/tugas?t=${sub.taskId}`);
  const parentLinks = await prisma.parentLink.findMany({ where: { childId: sub.studentId }, select: { parentId: true } });
  for (const p of parentLinks) {
    await createNotification(p.parentId, "nilai_keluar", msg, "/nilai");
  }
  revalidatePath("/tugas");
  redirect(`/tugas?t=${sub.taskId}`);
}
