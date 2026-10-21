import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyHandoffCode } from "@/lib/handoff";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/handoff/verify  { code, secret }
 *
 * Dipanggil CBT SERVER-ke-SERVER (bukan browser) untuk menukar kode
 * sekali-pakai → username. Secret dibandingkan timing-safe.
 * Pasangan: Ujian/app/Http/Controllers/Auth/HandoffController.php.
 */
export async function POST(req: NextRequest) {
  let body: { code?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const expected = process.env.CBT_HANDOFF_SECRET ?? "";
  const given = String(body.secret ?? "");
  if (!expected || given.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const okSecret = crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!okSecret) return NextResponse.json({ ok: false }, { status: 403 });

  const code = String(body.code ?? "");
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });

  const userId = await verifyHandoffCode(code);
  if (!userId) return NextResponse.json({ ok: false }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, username: user.username });
}
