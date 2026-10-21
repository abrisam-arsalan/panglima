import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deny = (status: number, msg: string) =>
  NextResponse.json({ ok: false, error: msg }, { status });

/**
 * GET /api/mpi/soal?game=<slug>&tingkat=7|8|9&mapel=<id>&sumber=demo|guru&order=asc|rand&limit=20
 *
 * Pengganti aman `mpi-portal/portal/api/questions.php`:
 * - WAJIB login portal (API lama publik + CORS *).
 * - TIDAK PERNAH mengirim answerKey/explanation ke klien (v1.4 §14.3).
 *   Koreksi jawaban lewat POST /api/mpi/jawab (server-side).
 * - sumber=guru fallback ke demo bila bank guru kosong (perilaku play.php lama).
 * - order=asc untuk game berurutan (Millionaire); default acak.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Wajib login");

  const q = req.nextUrl.searchParams;
  const slug = (q.get("game") ?? "").trim();
  if (!slug) return deny(400, "Parameter game wajib diisi");

  const game = await prisma.mpiGame.findUnique({ where: { slug } });
  if (!game || !game.aktif) return deny(404, "Game tidak ditemukan / nonaktif");

  const tingkatRaw = q.get("tingkat");
  const tingkat = tingkatRaw ? Number(tingkatRaw) : undefined;
  const mapelRaw = q.get("mapel");
  const mapelId = mapelRaw ? BigInt(mapelRaw) : undefined;
  const sumber = q.get("sumber") === "guru" ? "guru" : "demo";
  const order = q.get("order") === "asc" ? "asc" : "rand";
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 20), 1), 50);

  const baseWhere = {
    gameId: game.id,
    ...(tingkat && [7, 8, 9].includes(tingkat) ? { OR: [{ tingkat }, { tingkat: null }] } : {}),
    ...(mapelId ? { mpiSubjectId: mapelId } : {}),
  };

  // 1) Coba bank guru (soal non-demo) bila diminta
  let rows = sumber === "guru"
    ? await prisma.mpiQuestion.findMany({
        where: { ...baseWhere, isDemo: false },
        select: selectSoal,
        take: limit * 3,
      })
    : [];

  // 2) Fallback ke demo bila kosong (perilaku play.php lama)
  if (rows.length === 0) {
    rows = await prisma.mpiQuestion.findMany({
      where: { ...baseWhere, isDemo: true },
      select: selectSoal,
      take: limit * 3,
    });
  }

  const picked = order === "asc" ? rows.slice(0, limit) : shuffle(rows).slice(0, limit);

  return NextResponse.json({
    ok: true,
    game: { slug: game.slug, nama: game.nama },
    sumber: rows.length > 0 && sumber === "guru" ? "guru" : "demo",
    count: picked.length,
    soal: picked,
  });
}

const selectSoal = {
  id: true,
  pertanyaan: true,
  opsiA: true,
  opsiB: true,
  opsiC: true,
  opsiD: true,
  // SENGAJA tidak ada: answerKey, explanation — koreksi di server.
  payload: true,
} as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
