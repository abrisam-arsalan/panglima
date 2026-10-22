import { redirect } from "next/navigation";

/**
 * Helper keamanan terpusat (hasil audit pra-pull):
 * - toBigInt: parse ID tanpa throw (input jahat → null, bukan 500).
 * - safePath: allowlist redirect internal (anti open-redirect via FormData).
 */

/** Parse string → bigint; null bila bukan angka (tak pernah throw). */
export function toBigInt(v: unknown): bigint | null {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/** Kembalikan path internal yang aman; tolak URL absolut / // / .. */
export function safePath(raw: unknown, fallback: string): string {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("..") || /[\r\n]/.test(s)) {
    return fallback;
  }
  return s;
}

/** Redirect aman (pakai safePath). */
export function redirectSafe(raw: unknown, fallback: string): never {
  redirect(safePath(raw, fallback));
}
