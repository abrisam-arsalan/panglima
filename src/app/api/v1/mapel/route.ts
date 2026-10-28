import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/mapel → daftar mapel portal (id, nama, kode).
 * Auth: Authorization: Bearer $API_TOKEN (sama seperti /api/v1/siswa).
 * Dipakai halaman impor bank soal CBT agar dropdown mapel selalu sinkron.
 */
function tokenOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const want = process.env.API_TOKEN ?? "";
  if (!auth.startsWith("Bearer ") || !want || want.length < 16) return false;
  const a = Buffer.from(auth.slice(7).slice(0, 128));
  const b = Buffer.from(want.slice(0, 128));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: "Token tidak valid" }, { status: 401 });
  const rows = await prisma.subject.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    ok: true,
    total: rows.length,
    mapel: rows.map((s) => ({
      id: String(s.id),
      nama: s.name,
      kode: s.code,
    })),
  });
}
