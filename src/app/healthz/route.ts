import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Liveness utk systemd/nginx. Cek koneksi DB juga (murah).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: "panglima", ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
