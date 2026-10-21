import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const HANDOFF_TTL_MS = 60_000; // 60 detik

/** Buat kode sekali-pakai handoff portal → CBT. Kembalikan kode plaintext. */
export async function createHandoffCode(userId: bigint): Promise<string> {
  const plain = crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(plain + (process.env.CBT_HANDOFF_SECRET ?? "")).digest("hex");
  await prisma.handoffCode.create({
    data: {
      codeHash: hash,
      userId,
      target: "cbt",
      expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
    },
  });
  return plain;
}

/** Verifikasi kode dari CBT (server-ke-server). Kembalikan userId atau null. */
export async function verifyHandoffCode(plain: string): Promise<bigint | null> {
  const hash = crypto.createHash("sha256").update(plain + (process.env.CBT_HANDOFF_SECRET ?? "")).digest("hex");
  const code = await prisma.handoffCode.findUnique({ where: { codeHash: hash } });
  if (!code || code.usedAt || code.expiresAt < new Date()) return null;
  await prisma.handoffCode.update({ where: { codeHash: hash }, data: { usedAt: new Date() } });
  // Bersihkan kode kedaluwarsa/terpakai agar tabel tidak tumbuh tanpa batas.
  await prisma.handoffCode.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  }).catch(() => {});
  return code.userId;
}
