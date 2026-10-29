import { prisma } from "@/lib/prisma";

export const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Label ruang anti-duplikasi: data impor sering sudah berisi "Ruang 9C",
 * "Lab IPA", "Lapangan", dsb. — jangan tambah awalan bila sudah ada.
 * Mengembalikan "" bila kosong.
 */
export function roomLabel(room: string | null | undefined): string {
  const r = (room ?? "").trim();
  if (!r) return "";
  if (/^(ruang|lab\.?|laboratorium|lapangan|lap\.?|aula|kelas|r\.?)\b/i.test(r)) return r;
  return `Ruang ${r}`;
}

export async function createNotification(userId: bigint, kind: string, message: string, link?: string): Promise<void> {
  await prisma.notification.create({ data: { userId, kind, message, link } }).catch(() => {});
}

/** Kirim notifikasi ke semua siswa kelas tertentu beserta orang tuanya. */
export async function notifyClass(classId: bigint, kind: string, message: string, link?: string): Promise<void> {
  const students = await prisma.user.findMany({
    where: { classId, role: "SISWA", isActive: true, deletedAt: null },
    select: { id: true, parentLinksAsAnak: { select: { parentId: true } } },
  });
  const userIds: bigint[] = [];
  for (const s of students) {
    userIds.push(s.id);
    for (const p of s.parentLinksAsAnak) userIds.push(p.parentId);
  }
  if (!userIds.length) return;
  await prisma.notification.createMany({
    data: userIds.map((uid) => ({ userId: uid, kind, message, link })),
    skipDuplicates: true,
  }).catch(() => {});
}
