import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, logAudit, checkLoginThrottle, recordLoginAttempt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBigInt } from "@/lib/safe";

const deny = (status: number, msg: string) =>
  NextResponse.json({ ok: false, error: msg }, { status });

interface JawabanItem {
  soalId?: number | string;
  jawab?: string;
  game?: string;
}

/**
 * POST /api/mpi/jawab  { game, jawaban: [{ soalId, jawab: "A"|"B"|"C"|"D" }] }
 *
 * Koreksi server-side (P5): kunci TIDAK PERNAH ke klien.
 * Anti-oracle: soal WAJIB satu game (diikat slug), rate-limit 20/menit/user,
 * penjelasan HANYA untuk soal yang dijawab (bukan panen massal).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Wajib login");

  // Rate-limit ringan: 20 koreksi / menit / user (pakai tabel login_attempts).
  const gate = await checkLoginThrottle(`mpi:${user.id}`).catch(() => ({ throttled: false as const, waitMinutes: undefined as number | undefined }));
  if (gate.throttled) return deny(429, "Terlalu sering mengoreksi. Tunggu sebentar.");
  await recordLoginAttempt(`mpi:${user.id}`, user.id, true).catch(() => {});

  let body: { game?: string; jawaban?: JawabanItem[] };
  try {
    body = await req.json();
  } catch {
    return deny(400, "Request tidak valid");
  }
  const gameSlug = String(body.game ?? "").trim();
  const items = Array.isArray(body.jawaban) ? body.jawaban.slice(0, 20) : [];
  if (!gameSlug) return deny(400, "Parameter game wajib diisi");
  if (items.length === 0) return deny(400, "Daftar jawaban kosong");

  const game = await prisma.mpiGame.findUnique({ where: { slug: gameSlug }, select: { id: true, aktif: true } });
  if (!game || !game.aktif) return deny(404, "Game tidak ditemukan");

  const ids = items
    .map((it) => toBigInt(it.soalId))
    .filter((v): v is bigint => v !== null && v > BigInt(0));
  if (!ids.length) return deny(400, "ID soal tidak valid");

  // Ikat ke game: soal luar game ditolak (anti enumerasi lintas bank).
  const rows = await prisma.mpiQuestion.findMany({
    where: { id: { in: ids }, gameId: game.id },
    select: { id: true, answerKey: true, explanation: true },
  });
  const byId = new Map(rows.map((r) => [String(r.id), r]));

  let benar = 0;
  const hasil = items.map((it) => {
    const key = String(it.soalId ?? "");
    const row = byId.get(key);
    if (!row) return { soalId: key, benar: false, penjelasan: null as string | null };
    const given = String(it.jawab ?? "").toUpperCase().trim().charAt(0);
    if (!["A", "B", "C", "D"].includes(given)) {
      return { soalId: key, benar: false, penjelasan: null as string | null };
    }
    const ok = given === row.answerKey.toUpperCase().trim().charAt(0);
    if (ok) benar++;
    return { soalId: key, benar: ok, penjelasan: row.explanation ?? null };
  });

  await logAudit({
    userId: user.id,
    action: "MPI_JAWAB",
    entity: "mpi_questions",
    entityId: `${benar}/${items.length}`,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
  }).catch(() => {});

  return NextResponse.json({ ok: true, benar, total: items.length, skor: Math.round((benar / items.length) * 100), hasil });
}
