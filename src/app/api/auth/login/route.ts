import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  startSession,
  logAudit,
  checkLoginThrottle,
  recordLoginAttempt,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid" }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username & password wajib diisi" }, { status: 400 });
  }
  // Throttle persisten (tabel login_attempts): 5 gagal / 10 menit → tunggu 5 menit.
  // Bertahan restart/scale, tidak seperti rate-limit in-memory sebelumnya.
  const gate = await checkLoginThrottle(username).catch(() => ({ throttled: false as const, waitMinutes: undefined as number | undefined }));
  if (gate.throttled) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi ${gate.waitMinutes ?? 5} menit.` },
      { status: 429 }
    );
  }
  const user = await verifyCredentials(username, password);
  if (!user) {
    await recordLoginAttempt(username, null, false, ip);
    await logAudit({ action: "LOGIN_GAGAL", entity: "users", entityId: username, ip });
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  }
  await recordLoginAttempt(username, user.id, true, ip);
  await startSession(user.id, ip);
  await logAudit({ userId: user.id, action: "LOGIN", entity: "users", entityId: String(user.id), ip });
  return NextResponse.json({ ok: true, nama: user.nama, role: user.role });
}
