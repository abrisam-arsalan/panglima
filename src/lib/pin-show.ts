import crypto from "node:crypto";

const TTL_MS = 5 * 60_000;

function key(): Buffer {
  return crypto.createHash("sha256").update(process.env.AUTH_SECRET ?? "").digest();
}

/** Terbitkan token sekali-lihat PIN baru (admin → tunjuk ke user). */
export async function issuePinShow(adminId: bigint, userId: bigint, pin: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = `${Date.now() + TTL_MS}\n${adminId}\n${userId}\n${pin}`;
  const enc = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${enc.toString("hex")}.${cipher.getAuthTag().toString("hex")}`;
}

/** Baca token sekali-lihat. Null bila kedaluwarsa/rusak. */
export async function readPinShow(
  viewerId: bigint, token: string
): Promise<{ userId: string; pin: string; nama: string } | null> {
  try {
    const [ivH, encH, tagH] = token.split(".");
    if (!ivH || !encH || !tagH) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivH, "hex"));
    d.setAuthTag(Buffer.from(tagH, "hex"));
    const body = Buffer.concat([d.update(Buffer.from(encH, "hex")), d.final()]).toString("utf8");
    const [exp, adminId, userId, pin] = body.split("\n");
    if (Number(exp) < Date.now()) return null;
    if (BigInt(adminId) !== viewerId) return null; // hanya penerbit yang boleh lihat
    if (!/^\d{6}$/.test(pin ?? "")) return null;
    const { prisma } = await import("@/lib/prisma");
    const u = await prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { nama: true } });
    if (!u) return null;
    return { userId, pin, nama: u.nama };
  } catch {
    return null;
  }
}
