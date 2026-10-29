import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deny = (status: number, msg: string) =>
  NextResponse.json({ ok: false, error: msg }, { status });

/**
 * GET /api/questions.php?game=<slug>&order=asc|rand&limit=20
 *
 * Shim kompatibilitas untuk 9 game HTML MPI (public/game/*.html) yang masih
 * memanggil endpoint PHP lama. Format respons = format lama:
 *   { ok, game: { nama }, soal: [{ pertanyaan, opsi_a..d, kunci, penjelasan, payload, topik }] }
 *
 * Keamanan: HANYA guru/admin (yang membuka game di IFP/laptop kelas).
 * Siswa TIDAK boleh memanggil endpoint ini (kunci ikut terkirim — game
 * butuh kunci lokal untuk tombol LIHAT KUNCI + koreksi overlay guru).
 * Kuis individu siswa tetap via /api/mpi/soal + /api/mpi/jawab (tanpa kunci).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Wajib login");
  if (user.role !== "GURU" && user.role !== "ADMIN") {
    return deny(403, "Mode arena kelas hanya untuk guru");
  }

  const q = req.nextUrl.searchParams;
  const slug = (q.get("game") ?? "").trim();
  if (!slug) return deny(400, "Parameter game wajib diisi");

  const game = await prisma.mpiGame.findUnique({ where: { slug } });
  if (!game || !game.aktif) return deny(404, "Game tidak ditemukan / nonaktif");

  const order = q.get("order") === "asc" ? "asc" : "rand";
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 40), 1), 100);

  const rows = await prisma.mpiQuestion.findMany({
    where: { gameId: game.id },
    select: {
      id: true,
      pertanyaan: true,
      opsiA: true,
      opsiB: true,
      opsiC: true,
      opsiD: true,
      answerKey: true,
      explanation: true,
      payload: true,
    },
    take: limit * 2,
  });

  const picked =
    order === "asc" ? rows.slice(0, limit) : [...rows].sort(() => Math.random() - 0.5).slice(0, limit);

  return NextResponse.json({
    ok: true,
    game: { slug: game.slug, nama: game.nama },
    count: picked.length,
    soal: picked.map((r) => ({
      id: String(r.id),
      pertanyaan: r.pertanyaan,
      opsi_a: r.opsiA,
      opsi_b: r.opsiB,
      opsi_c: r.opsiC,
      opsi_d: r.opsiD,
      kunci: r.answerKey,
      penjelasan: r.explanation,
      payload: r.payload,
    })),
  });
}
