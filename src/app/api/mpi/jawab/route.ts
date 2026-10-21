import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deny = (status: number, msg: string) =>
  NextResponse.json({ ok: false, error: msg }, { status });

interface JawabanItem {
  soalId?: number | string;
  jawab?: string;
}

/**
 * POST /api/mpi/jawab  { jawaban: [{ soalId, jawab: "A"|"B"|"C"|"D" }] }
 *
 * Koreksi server-side (P5): kunci TIDAK PERNAH ke klien.
 * Mengembalikan benar/salah + penjelasan per butir + skor total.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Wajib login");

  let body: { jawaban?: JawabanItem[] };
  try {
    body = await req.json();
  } catch {
    return deny(400, "Request tidak valid");
  }
  const items = Array.isArray(body.jawaban) ? body.jawaban.slice(0, 50) : [];
  if (items.length === 0) return deny(400, "Daftar jawaban kosong");

  const ids = items
    .map((it) => {
      try {
        return BigInt(String(it.soalId ?? "0"));
      } catch {
        return null;
      }
    })
    .filter((v): v is bigint => v !== null && v > BigInt(0));

  const rows = await prisma.mpiQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true, answerKey: true, explanation: true },
  });
  const byId = new Map(rows.map((r) => [String(r.id), r]));

  let benar = 0;
  const hasil = items.map((it) => {
    const key = String(it.soalId ?? "");
    const row = byId.get(key);
    if (!row) return { soalId: key, benar: false, penjelasan: null as string | null };
    const given = String(it.jawab ?? "").toUpperCase().trim().charAt(0);
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
