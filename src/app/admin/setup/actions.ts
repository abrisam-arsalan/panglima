"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, logAudit } from "@/lib/auth";

async function guard() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Hanya admin yang berwenang");
  return u;
}

/**
 * Setup awal portal (sekali setelah migrate + reset-admin):
 * buat tahun ajaran + semester Ganjil/Genap dan tandai aktif.
 * Idempoten — aman diulang (upsert per nama/nomor).
 */
export async function setupTahunAjaran(formData: FormData) {
  const admin = await guard();
  const name = String(formData.get("name") ?? "").trim() || "2026/2027";
  const semesterNumber = Number(String(formData.get("semesterNumber") ?? "1")) === 2 ? 2 : 1;

  // Tahun ajaran Indonesia: Juli–Juni. Ambil tahun awal dari nama "2026/2027".
  const startYear = Number(name.slice(0, 4)) || new Date().getFullYear();
  const year = await prisma.academicYear.upsert({
    where: { name },
    create: {
      name,
      isActive: true,
      startDate: new Date(`${startYear}-07-01`),
      endDate: new Date(`${startYear + 1}-06-30`),
    },
    update: { isActive: true },
  });
  // Nonaktifkan tahun lain agar satu sumber kebenaran waktu akademik.
  await prisma.academicYear.updateMany({ where: { id: { not: year.id } }, data: { isActive: false } });

  for (const n of [1, 2]) {
    await prisma.semester.upsert({
      where: { yearId_number: { yearId: year.id, number: n } },
      create: { yearId: year.id, number: n, name: n === 1 ? "Ganjil" : "Genap", isActive: n === semesterNumber },
      update: { isActive: n === semesterNumber },
    });
  }

  await logAudit({
    userId: admin.id,
    action: "SETUP_TAHUN",
    entity: "academic_years",
    entityId: name,
    detail: { semesterAktif: semesterNumber },
  });

  revalidatePath("/admin/setup");
  revalidatePath("/admin/penugasan");
  revalidatePath("/dashboard");
  redirect(`/admin/setup?msg=${encodeURIComponent(`Tahun ${name} semester ${semesterNumber === 1 ? "Ganjil" : "Genap"} aktif. Lanjut impor kelas → guru → siswa → jadwal.`)}`);
}
