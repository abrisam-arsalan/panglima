"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";
import { getSessionUser, logAudit, assertPinClear } from "@/lib/auth";

async function staff() {
  const user = await getSessionUser();
  assertPinClear(user);
  if (!user || (user.role !== "GURU" && user.role !== "ADMIN")) redirect("/login");
  return user;
}

const KUNCI = ["A", "B", "C", "D"];

/** Tambah butir soal ke bank. Guru = milik sendiri; admin boleh tandai demo. */
export async function addSoal(formData: FormData) {
  const user = await staff();

  const gameId = toBigInt(formData.get("gameId")) ?? BigInt(0);
  const pertanyaan = String(formData.get("pertanyaan") ?? "").trim();
  const opsiA = String(formData.get("opsiA") ?? "").trim() || null;
  const opsiB = String(formData.get("opsiB") ?? "").trim() || null;
  const opsiC = String(formData.get("opsiC") ?? "").trim() || null;
  const opsiD = String(formData.get("opsiD") ?? "").trim() || null;
  const answerKey = String(formData.get("answerKey") ?? "A").toUpperCase().trim().charAt(0);
  const explanation = String(formData.get("explanation") ?? "").trim() || null;
  const tingkatRaw = String(formData.get("tingkat") ?? "").trim();
  const tingkat = tingkatRaw ? Number(tingkatRaw) : null;
  const subjectRaw = String(formData.get("subjectId") ?? "").trim();
  const isDemo = user.role === "ADMIN" && formData.get("isDemo") === "1";

  if (!gameId || !pertanyaan) throw new Error("Game & pertanyaan wajib diisi");
  if (!KUNCI.includes(answerKey)) throw new Error("Kunci harus A/B/C/D");
  if (tingkat !== null && ![7, 8, 9].includes(tingkat)) throw new Error("Tingkat harus 7/8/9 atau semua");

  const q = await prisma.mpiQuestion.create({
    data: {
      gameId,
      pertanyaan,
      opsiA,
      opsiB,
      opsiC,
      opsiD,
      answerKey,
      explanation,
      tingkat,
      mpiSubjectId: subjectRaw ? BigInt(subjectRaw) : null,
      isDemo,
      ownerId: isDemo ? null : user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: "MPI_SOAL_TAMBAH",
    entity: "mpi_questions",
    entityId: String(q.id),
  });

  revalidatePath("/mpi/bank");
}

/** Hapus butir soal — pemilik atau admin. */
export async function deleteSoal(formData: FormData) {
  const user = await staff();
  const id = toBigInt(formData.get("id")) ?? BigInt(0);
  const q = await prisma.mpiQuestion.findUnique({ where: { id } });
  if (!q) throw new Error("Soal tidak ditemukan");
  if (user.role !== "ADMIN" && q.ownerId !== user.id) throw new Error("Hanya pemilik / admin");

  await prisma.mpiQuestion.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "MPI_SOAL_HAPUS", entity: "mpi_questions", entityId: String(id) });
  revalidatePath("/mpi/bank");
}

/** Tambah mapel bank soal (nama unik). */
export async function addSubject(formData: FormData) {
  const user = await staff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nama mapel wajib diisi");
  await prisma.mpiSubject.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  await logAudit({ userId: user.id, action: "MPI_MAPEL_TAMBAH", entity: "mpi_subjects", entityId: name });
  revalidatePath("/mpi/bank");
}
