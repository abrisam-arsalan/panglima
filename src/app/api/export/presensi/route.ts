import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { currentSemester } from "@/lib/academic";

/**
 * GET /api/export/presensi?periode=minggu|bulan|semester&classId?=[&fmt=csv]
 * Rekap kehadiran per siswa: NO | NISN | NAMA | HADIR | SAKIT | IZIN | ALPHA | %HADIR.
 * Workbook: 1 sheet per rombel (mudah dibaca wali kelas; kurikulum terima 1 file).
 * Periode: minggu berjalan (Senin–Sabtu), bulan kalender berjalan, atau
 * semester aktif. CSV fallback: blok per rombel seperti /api/export/xlsx.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !["GURU", "ADMIN", "KEPSEK"].includes(user.role)) {
    return NextResponse.json({ error: "Tidak berhak" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const periode = sp.get("periode") ?? "minggu";
  if (!["minggu", "bulan", "semester"].includes(periode)) {
    return NextResponse.json({ error: "periode harus minggu|bulan|semester" }, { status: 400 });
  }
  const fmt = sp.get("fmt") === "csv" ? "csv" : "xlsx";
  const classIdRaw = sp.get("classId");
  const onlyClassId = classIdRaw ? BigInt(classIdRaw) : null;

  const ctx = await currentSemester();
  const now = new Date();
  let dari: Date;
  let sampai = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let label: string;
  if (periode === "minggu") {
    // Senin–Sabtu minggu berjalan (WIB).
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = d.getDay(); // 0=Minggu
    const senin = new Date(d);
    senin.setDate(d.getDate() - ((dow + 6) % 7));
    dari = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate(), 0, 0, 0);
    label = `MINGGU ${senin.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}–${sampai.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  } else if (periode === "bulan") {
    dari = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    label = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();
  } else {
    dari = new Date(2000, 0, 1);
    if (ctx) {
      const m = ctx.year.name.match(/(\d{4})/);
      if (m) dari = new Date(Number(m[1]), ctx.semester.name.toLowerCase().includes("genap") ? 0 : 6, 1);
    }
    label = ctx ? `SEMESTER ${ctx.semester.name.toUpperCase()} ${ctx.year.name}` : "SEMESTER BERJALAN";
  }

  const classes = await prisma.class.findMany({
    where: {
      isActive: true,
      ...(onlyClassId ? { id: onlyClassId } : {}),
      ...(ctx ? { academicYearId: ctx.year.id } : {}),
    },
    orderBy: [{ tingkat: "asc" }, { name: "asc" }],
  });
  if (!classes.length) {
    return NextResponse.json({ error: "Tidak ada rombel" }, { status: 404 });
  }
  const classIds = classes.map((c) => c.id);

  // Guru hanya boleh mengekspor rombel yang diajarnya (konsisten dgn /nilai).
  let allowedIds: Set<string> | null = null;
  if (user.role === "GURU") {
    const mine = await prisma.assignment.findMany({
      where: { teacherId: user.id, classId: { in: classIds } },
      select: { classId: true },
    });
    allowedIds = new Set(mine.map((a) => String(a.classId)));
    if (!allowedIds.size) {
      return NextResponse.json({ error: "Tidak ada rombel yang Anda ampu" }, { status: 404 });
    }
  }

  const students = await prisma.user.findMany({
    where: {
      classId: { in: classIds },
      role: "SISWA",
      isActive: true,
      deletedAt: null,
      ...(allowedIds ? { classId: { in: [...allowedIds].map((s) => BigInt(s)) } } : {}),
    },
    select: { id: true, classId: true, nama: true, nisn: true },
    orderBy: { nama: "asc" },
  });

  // Satu query agregat: hitung status per siswa dalam rentang.
  const agg = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: {
      student: { classId: { in: classIds }, role: "SISWA" },
      session: { date: { gte: dari, lte: sampai } },
    },
    _count: { _all: true },
  });
  const hitung = new Map<string, { HADIR: number; SAKIT: number; IZIN: number; ALPHA: number }>();
  for (const a of agg) {
    const k = String(a.studentId);
    const c = hitung.get(k) ?? { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 };
    c[a.status] = a._count._all;
    hitung.set(k, c);
  }

  const targetClasses = allowedIds
    ? classes.filter((c) => allowedIds.has(String(c.id)))
    : classes;

  const rowsFor = (classId: bigint) =>
    students
      .filter((s) => s.classId === classId)
      .map((s, i) => {
        const c = hitung.get(String(s.id)) ?? { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0 };
        const total = c.HADIR + c.SAKIT + c.IZIN + c.ALPHA;
        const persen = total > 0 ? Math.round((c.HADIR / total) * 100) : 0;
        return [String(i + 1), s.nisn ?? "", s.nama, c.HADIR, c.SAKIT, c.IZIN, c.ALPHA, persen];
      });

  const baseName = `rekap-presensi-${periode}-${label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  const head = ["NO", "NISN", "NAMA SISWA", "HADIR", "SAKIT", "IZIN", "ALPHA", "%HADIR"];

  if (fmt === "csv") {
    let csv = "";
    for (const c of targetClasses) {
      csv += `## REKAP PRESENSI ${label} — KELAS ${c.name}\n`;
      csv += head.join(",") + "\n";
      for (const r of rowsFor(c.id)) csv += r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\n";
      csv += "\n";
    }
    return new NextResponse("" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal Panglima SMPN 5 Tegal";
  for (const c of targetClasses) {
    const ws = wb.addWorksheet(c.name);
    ws.addRow([`REKAP PRESENSI ${label} — KELAS ${c.name}`]);
    ws.addRow(head);
    for (const r of rowsFor(c.id)) ws.addRow(r);
    ws.getRow(1).font = { bold: true };
    ws.getRow(2).font = { bold: true };
    ws.getRow(2).alignment = { vertical: "middle", wrapText: true };
    ws.getRow(2).height = 30;
    [5, 15, 30, 9, 9, 9, 9, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as unknown as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
