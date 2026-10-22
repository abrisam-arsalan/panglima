import crypto from "node:crypto";

/**
 * Sesi preview impor PTS: teks CSV sheet dienkripsi (AES-256-GCM, kunci
 * AUTH_SECRET) agar tidak lewat URL / form terlihat. TTL 15 menit.
 * Token = iv.cipher.authtag (hex). Tanpa DB tambahan.
 */
const TTL_MS = 15 * 60_000;

function key(): Buffer {
  const raw = process.env.AUTH_SECRET ?? "";
  return crypto.createHash("sha256").update(raw).digest();
}

export async function encryptPreview(text: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const exp = String(Date.now() + TTL_MS);
  const body = exp + "\n" + text;
  const enc = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${enc.toString("hex")}.${tag.toString("hex")}`;
}

export async function decryptPreview(token: string): Promise<string | null> {
  try {
    const [ivH, encH, tagH] = token.split(".");
    if (!ivH || !encH || !tagH) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivH, "hex"));
    decipher.setAuthTag(Buffer.from(tagH, "hex"));
    const body = Buffer.concat([decipher.update(Buffer.from(encH, "hex")), decipher.final()]).toString("utf8");
    const nl = body.indexOf("\n");
    if (nl < 0) return null;
    if (Number(body.slice(0, nl)) < Date.now()) return null; // kedaluwarsa
    return body.slice(nl + 1);
  } catch {
    return null;
  }
}
