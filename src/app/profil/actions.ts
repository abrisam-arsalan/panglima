"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser, hashPassword, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Ubah nama tampilan sendiri (bukan username/NISN/NIP — identitas login tetap). */
export async function updateProfileName(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nama = String(formData.get("nama") ?? "").trim().slice(0, 120);
  if (nama.length < 3) {
    redirect("/profil?err=" + encodeURIComponent("Nama minimal 3 huruf"));
  }

  await prisma.user.update({ where: { id: user.id }, data: { nama } });
  await logAudit({
    userId: user.id,
    action: "PROFIL_UBAH_NAMA",
    entity: "users",
    entityId: String(user.id),
    detail: { nama },
  });

  revalidatePath("/profil");
  redirect("/profil?msg=" + encodeURIComponent("Nama tampilan diperbarui"));
}

/**
 * Ganti password/PIN sendiri. Wajib memasukkan password lama dengan benar —
 * mencegah penyalahgunaan sesi yang tertinggal terbuka.
 * Aturan: siswa = 6 digit angka (selaras login PIN); peran lain min 6 karakter.
 */
export async function updateProfilePassword(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const oldPass = String(formData.get("oldPassword") ?? "");
  const newPass = String(formData.get("newPassword") ?? "").trim();
  const confirmPass = String(formData.get("confirmPassword") ?? "").trim();

  const ok = await bcrypt.compare(oldPass, user.passwordHash);
  if (!ok) {
    redirect("/profil?err=" + encodeURIComponent("Password lama salah"));
  }

  if (user.role === "SISWA") {
    if (!/^\d{6}$/.test(newPass)) {
      redirect("/profil?err=" + encodeURIComponent("PIN siswa harus tepat 6 digit angka"));
    }
  } else if (newPass.length < 6) {
    redirect("/profil?err=" + encodeURIComponent("Password minimal 6 karakter"));
  }

  if (newPass !== confirmPass) {
    redirect("/profil?err=" + encodeURIComponent("Konfirmasi password tidak cocok"));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPass),
      // Admin/guru/ortu tidak memakai PIN tercetak — kosongkan sisa cipher lama.
      ...(user.role === "SISWA" ? { pinCipher: newPass } : { pinCipher: null }),
      mustChangePin: false,
    },
  });

  await logAudit({
    userId: user.id,
    action: "PROFIL_GANTI_PASSWORD",
    entity: "users",
    entityId: String(user.id),
  });

  revalidatePath("/profil");
  redirect("/profil?msg=" + encodeURIComponent("Password berhasil diganti"));
}
