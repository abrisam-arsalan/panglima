import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdminSurface } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";

/**
 * GET /api/cetak-xlsx?classId=123 — unduh rekap nilai rombel (admin only).
 * Kolom: No, Nama, NISN, [asesmen per mapel], Rata-rata. Baris judul + kop.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminSurface("api/cetak-xlsx");
  } catch {
    return NextResponse.json({ error: "Tidak berhak" }, { status: 403 });
  }

  const raw = req.nextUrl.searchParams.get("classId") ?? "";
  if (!/^\d+$/.test(raw)) return NextResponse.json({ error: "Parameter classId wajib" }, { status: 400 });
  const classId = BigInt(raw);
  const ctx = await currentSemester();

  const rombel = await prisma.class.findUnique({
    where: { id: classId },
    include: { homeroom: { select: { nama: true } }, academicYear: { select: { name: true } } },
  });
  if (!rombel) return NextResponse.json({ error: "Rombel tidak ditemukan" }, { status: 404 });

  const siswa = await prisma.user.findMany({
    where: { classId, role: "SISWA", deletedAt: null },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, nisn: true },
  });

  const asesmens = await prisma.manualAssessment.findMany({
    where: { assignment: { classId, ...(ctx ? { semesterId: ctx.semester.id } : {}) } },
    include: {
      assignment: { include: { subject: true } },
      grades: { where: { studentId: { in: siswa.map((s) => s.id) } } },
    },
    orderBy: [{ assignment: { subject: { name: "asc" } } }, { nama: "asc" }],
  });

  const gradeMap = new Map<string, number>();
  for (const a of asesmens) {
    for (const g of a.grades) gradeMap.set(`${a.id}|${g.studentId}`, Number(g.score));
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Rekap ${rombel.name}`, { properties: { tabColor: { argb: "FF1E3A8A" } } });
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  ws.addRow(["REKAPITULASI HASIL PENILAIAN TENGAH SEMESTER"]);
  ws.addRow([`SMP Negeri 5 Tegal · Tahun ${rombel.academicYear?.name ?? ctx?.year.name ?? ""} · Rombel ${rombel.name} · Wali: ${rombel.homeroom?.nama ?? "-"} · ${tanggal}`]);
  ws.addRow([]);
  const header = ["No", "Nama", "NISN", ...asesmens.map((a) => `${a.assignment.subject.name} (${a.nama})`), "Rata-rata"];
  const hr = ws.addRow(header);
  hr.font = { bold: true };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD54F" } };

  siswa.forEach((s, i) => {
    const vals = asesmens
      .map((a) => gradeMap.get(`${a.id}|${s.id}`))
      .filter((v): v is number => v !== undefined);
    const avg = vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 100) / 100 : null;
    ws.addRow([
      i + 1,
      s.nama,
      s.nisn ?? "-",
      ...asesmens.map((a) => gradeMap.get(`${a.id}|${s.id}`) ?? "-"),
      avg ?? "-",
    ]);
  });

  ws.columns.forEach((c) => { c.width = 18; });
  ws.getColumn(2).width = 32;

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-${rombel.name}.xlsx"`,
    },
  });
}
