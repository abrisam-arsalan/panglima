"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { broadcastNewCbtExams, syncStudentsToCbt } from "@/lib/cbt-sync";

export async function launchCbt() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Handoff portal → CBT (PRD v2 §6): terbitkan kode sekali-pakai TTL 60 dtk,
  // redirect ke /sso?kode=... agar user tidak mengetik ulang kredensial.
  // Login manual di CBT TETAP berfungsi sebagai fallback (syarat ujian).
  // Selama CBT lama belum di-update (belum ada route /sso), set
  // CBT_SSO_ENABLED=0 agar tombol = redirect login biasa (tanpa 404).
  const cbtBaseUrl = process.env.CBT_BASE_URL;
  if (!cbtBaseUrl) throw new Error("CBT_BASE_URL belum diset di .env");
  if (process.env.CBT_SSO_ENABLED === "1") {
    const { createHandoffCode } = await import("@/lib/handoff");
    const code = await createHandoffCode(user.id);
    redirect(`${cbtBaseUrl}/sso?kode=${code}`);
  }
  const isStaff = user.role === "ADMIN" || user.role === "GURU" || user.role === "KEPSEK";
  redirect(isStaff ? `${cbtBaseUrl}/admin/login` : `${cbtBaseUrl}/login`);
}

export async function broadcastExamsAction() {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "GURU")) redirect("/login");

  await broadcastNewCbtExams();
  revalidatePath("/ujian");
  revalidatePath("/dashboard");
  revalidatePath("/pengumuman");
  revalidatePath("/notifikasi");
}

export async function syncStudentsAction() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  await syncStudentsToCbt();
  revalidatePath("/ujian");
  revalidatePath("/admin/ujian");
}
