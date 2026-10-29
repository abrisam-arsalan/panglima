import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classAssignments, currentSemester, studentClassId, teacherAssignments } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import DangerSubmit from "@/components/danger-submit";
import { DAYS, roomLabel } from "@/lib/notify";
import { activateSchedule, addSchedule, deleteSchedule } from "./actions";
import { importBulkAction } from "@/app/admin/akun/actions";

import type { Prisma } from "@prisma/client";

interface TimelineSlot {
  type: "break" | "lesson";
  time: string;
  start?: string;
  end?: string;
  jamKe?: number;
  label?: string;
}

const DAY_TIMELINES: Record<number, TimelineSlot[]> = {
  1: [ // SENIN
    { type: "break", time: "06:55 – 07:25", label: "UPACARA / TADARUS" },
    { type: "break", time: "07:25 – 07:40", label: "LITERASI / BIMBINGAN WALI KELAS" },
    { type: "lesson", jamKe: 1, start: "07:40", end: "08:15", time: "07:40 – 08:15" },
    { type: "lesson", jamKe: 2, start: "08:15", end: "08:50", time: "08:15 – 08:50" },
    { type: "lesson", jamKe: 3, start: "08:50", end: "09:25", time: "08:50 – 09:25" },
    { type: "break", time: "09:25 – 09:40", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 4, start: "09:40", end: "10:15", time: "09:40 – 10:15" },
    { type: "lesson", jamKe: 5, start: "10:15", end: "10:50", time: "10:15 – 10:50" },
    { type: "lesson", jamKe: 6, start: "10:50", end: "11:25", time: "10:50 – 11:25" },
    { type: "lesson", jamKe: 7, start: "11:25", end: "12:00", time: "11:25 – 12:00" },
    { type: "break", time: "12:00 – 12:30", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 8, start: "12:30", end: "13:05", time: "12:30 – 13:05" },
  ],
  2: [ // SELASA
    { type: "break", time: "06:55 – 07:25", label: "TADARUS DAN MENYANYIKAN LAGU INDONESIA RAYA" },
    { type: "break", time: "07:25 – 07:40", label: "LITERASI / BIMBINGAN WALI KELAS" },
    { type: "lesson", jamKe: 1, start: "07:40", end: "08:15", time: "07:40 – 08:15" },
    { type: "lesson", jamKe: 2, start: "08:15", end: "08:50", time: "08:15 – 08:50" },
    { type: "lesson", jamKe: 3, start: "08:50", end: "09:25", time: "08:50 – 09:25" },
    { type: "break", time: "09:25 – 09:40", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 4, start: "09:40", end: "10:15", time: "09:40 – 10:15" },
    { type: "lesson", jamKe: 5, start: "10:15", end: "10:50", time: "10:15 – 10:50" },
    { type: "lesson", jamKe: 6, start: "10:50", end: "11:25", time: "10:50 – 11:25" },
    { type: "lesson", jamKe: 7, start: "11:25", end: "12:00", time: "11:25 – 12:00" },
    { type: "break", time: "12:00 – 12:30", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 8, start: "12:30", end: "13:05", time: "12:30 – 13:05" },
  ],
  3: [ // RABU
    { type: "break", time: "06:55 – 07:25", label: "TADARUS DAN MENYANYIKAN LAGU INDONESIA RAYA" },
    { type: "break", time: "07:25 – 07:40", label: "LITERASI / BIMBINGAN WALI KELAS" },
    { type: "lesson", jamKe: 1, start: "07:40", end: "08:15", time: "07:40 – 08:15" },
    { type: "lesson", jamKe: 2, start: "08:15", end: "08:50", time: "08:15 – 08:50" },
    { type: "lesson", jamKe: 3, start: "08:50", end: "09:25", time: "08:50 – 09:25" },
    { type: "break", time: "09:25 – 09:40", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 4, start: "09:40", end: "10:15", time: "09:40 – 10:15" },
    { type: "lesson", jamKe: 5, start: "10:15", end: "10:50", time: "10:15 – 10:50" },
    { type: "lesson", jamKe: 6, start: "10:50", end: "11:25", time: "10:50 – 11:25" },
    { type: "lesson", jamKe: 7, start: "11:25", end: "12:00", time: "11:25 – 12:00" },
    { type: "break", time: "12:00 – 12:30", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 8, start: "12:30", end: "13:05", time: "12:30 – 13:05" },
  ],
  4: [ // KAMIS
    { type: "break", time: "06:55 – 07:25", label: "TADARUS DAN MENYANYIKAN LAGU INDONESIA RAYA" },
    { type: "break", time: "07:25 – 07:40", label: "LITERASI / BIMBINGAN WALI KELAS" },
    { type: "lesson", jamKe: 1, start: "07:40", end: "08:15", time: "07:40 – 08:15" },
    { type: "lesson", jamKe: 2, start: "08:15", end: "08:50", time: "08:15 – 08:50" },
    { type: "lesson", jamKe: 3, start: "08:50", end: "09:25", time: "08:50 – 09:25" },
    { type: "break", time: "09:25 – 09:40", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 4, start: "09:40", end: "10:15", time: "09:40 – 10:15" },
    { type: "lesson", jamKe: 5, start: "10:15", end: "10:50", time: "10:15 – 10:50" },
    { type: "lesson", jamKe: 6, start: "10:50", end: "11:25", time: "10:50 – 11:25" },
    { type: "lesson", jamKe: 7, start: "11:25", end: "12:00", time: "11:25 – 12:00" },
    { type: "break", time: "12:00 – 12:30", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 8, start: "12:30", end: "13:05", time: "12:30 – 13:05" },
  ],
  5: [ // JUMAT
    { type: "break", time: "07:00 – 07:30", label: "TADARUS DAN MENYANYIKAN LAGU INDONESIA RAYA" },
    { type: "break", time: "07:30 – 08:15", label: "SENAM / JALAN SEHAT / KEBERSIHAN" },
    { type: "lesson", jamKe: 1, start: "08:15", end: "08:50", time: "08:15 – 08:50" },
    { type: "lesson", jamKe: 2, start: "08:50", end: "09:25", time: "08:50 – 09:25" },
    { type: "break", time: "09:25 – 09:40", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 3, start: "09:40", end: "10:15", time: "09:40 – 10:15" },
    { type: "lesson", jamKe: 4, start: "10:15", end: "10:50", time: "10:15 – 10:50" },
  ],
  6: [ // SABTU
    { type: "break", time: "06:55 – 07:30", label: "TADARUS DAN MENYANYIKAN LAGU INDONESIA RAYA" },
    { type: "lesson", jamKe: 1, start: "07:30", end: "08:05", time: "07:30 – 08:05" },
    { type: "lesson", jamKe: 2, start: "08:05", end: "08:40", time: "08:05 – 08:40" },
    { type: "lesson", jamKe: 3, start: "08:40", end: "09:15", time: "08:40 – 09:15" },
    { type: "break", time: "09:15 – 09:30", label: "ISTIRAHAT" },
    { type: "lesson", jamKe: 4, start: "09:30", end: "10:05", time: "09:30 – 10:05" },
    { type: "lesson", jamKe: 5, start: "10:05", end: "10:40", time: "10:05 – 10:40" },
    { type: "lesson", jamKe: 6, start: "10:40", end: "11:15", time: "10:40 – 11:15" },
  ],
};

const ORDERED_CLASSES = [
  "7A", "7B", "7C", "7D", "7E", "7F",
  "8A", "8B", "8C", "8D", "8E", "8F",
  "9A", "9B", "9C", "9D", "9E", "9F"
];

async function loadSchedules(assignmentWhere: Prisma.AssignmentWhereInput) {
  return prisma.schedule.findMany({
    where: { assignment: assignmentWhere },
    include: {
      assignment: {
        include: { subject: true, class: true, teacher: { select: { nama: true } } },
      },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
}

function WeekView({ rows, today, showInactive = false }: { rows: Awaited<ReturnType<typeof loadSchedules>>; today: number; showInactive?: boolean }) {
  const byDay = new Map<number, typeof rows>();
  for (const r of rows) {
    if (!showInactive && r.isActive === false) continue; // nonaktif: hanya admin di panel kelola
    const arr = byDay.get(r.day) ?? [];
    arr.push(r);
    byDay.set(r.day, arr);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b).filter((d) => d >= 1);
  const nowStr = new Date().toTimeString().slice(0, 5);

  return (
    <>
      {days.map((d) => (
        <div className="card" key={d}>
          <div className="card-head">
            <h2>{DAYS[d]}</h2>
            {d === today && <span className="badge badge-green">HARI INI</span>}
          </div>
          <div className="card-body">
            {byDay.get(d)!.map((s) => {
              const isToday = s.day === today;
              const isOngoing = isToday && nowStr >= s.startTime && nowStr <= s.endTime;
              const isPast = isToday && nowStr > s.endTime;
              return (
                <div className="list-row" key={String(s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <b style={{ fontSize: 16 }}>{s.assignment.subject.name}</b>
                      <span className="badge badge-yellow">⏰ {s.startTime} – {s.endTime}</span>
                      {roomLabel(s.room) && <span className="pill">{roomLabel(s.room)}</span>}
                      {isToday && (
                        isOngoing ? (
                          <span className="badge badge-green">SEDANG BERLANGSUNG</span>
                        ) : isPast ? (
                          <span className="badge badge-neutral">SELESAI</span>
                        ) : (
                          <span className="badge badge-yellow">AKAN DATANG</span>
                        )
                      )}
                    </div>
                    <div className="meta">
                      Kelas {s.assignment.class.name} · Guru Pengampu: {s.assignment.teacher?.nama ?? "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!days.length && <div className="empty">Belum ada jadwal pelajaran untuk rombel ini.</div>}
    </>
  );
}

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<{
    a?: string;
    childId?: string;
    tab?: string;
    day?: string;
    guruId?: string;
    classId?: string;
    err?: string;
    msg?: string;
    done?: string;
    created?: string;
    existing?: string;
    skipped?: string;
  }>;
}) {
  const user = await requireUser();
  const { a, childId: rawChildId, tab = "matriks", day: rawDay, guruId, classId: rawClassId, err, msg, done, created, existing, skipped } = await searchParams;
  const ctx = await currentSemester();
  const semesterId = ctx?.semester.id;
  const today = new Date().getDay();

  // ── 1. DETAIL SLOT ASSIGNMENT KHUSUS (KELOLA JAM OLEH ADMIN / DETAIL MAPEL GURU) ──
  if (a) {
    const assignmentId = BigInt(a);
    if (user.role === "GURU") {
      const own = await prisma.assignment.findFirst({ where: { id: assignmentId, teacherId: user.id }, select: { id: true } });
      if (!own) redirect("/jadwal");
    } else if (user.role !== "ADMIN" && user.role !== "KEPSEK") {
      redirect("/jadwal");
    }

    const rows = await loadSchedules({ id: assignmentId });
    const asg = rows[0]?.assignment;
    return (
      <AppShell user={user} active="/jadwal">
        <div className="breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span className="sep">&gt;</span>
          <Link href="/jadwal">Jadwal</Link>
          <span className="sep">&gt;</span>
          <span className="current">{asg ? `${asg.class.name} · ${asg.subject.name}` : "Rombel"}</span>
        </div>
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>Jadwal Pelajaran{asg ? ` — ${asg.class.name} · ${asg.subject.name}` : ""}</h1>
            {user.role === "ADMIN" ? (
              <p className="muted">Mode kelola — tambah atau hapus slot jam pelajaran untuk rombel ini.</p>
            ) : (
              <p className="muted">Jadwal tatap muka mingguan untuk mata pelajaran ini.</p>
            )}
          </div>
          <Link className="btn btn-sm" href="/jadwal">← Kembali ke Jadwal Master</Link>
        </div>

        {user.role === "ADMIN" && (
          <div className="card">
            <div className="card-head"><h2>➕ Tambah Jam Pelajaran</h2></div>
            <div className="card-body">
              <form action={addSchedule} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch", width: "100%" }}>
                <input type="hidden" name="assignmentId" value={a} />
                <div className="field" style={{ margin: 0, flex: "1 1 120px" }}>
                  <label className="field-label">Hari</label>
                  <select className="input" name="day" defaultValue={String(today >= 1 && today <= 6 ? today : 1)} style={{ minHeight: 44 }}>
                    {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, flex: "1 1 100px" }}>
                  <label className="field-label">Mulai</label>
                  <input className="input" type="time" name="start" required defaultValue="07:40" style={{ minHeight: 44 }} />
                </div>
                <div className="field" style={{ margin: 0, flex: "1 1 100px" }}>
                  <label className="field-label">Selesai</label>
                  <input className="input" type="time" name="end" required defaultValue="08:15" style={{ minHeight: 44 }} />
                </div>
                <div className="field" style={{ margin: 0, flex: "1 1 120px" }}>
                  <label className="field-label">Ruang Kelas</label>
                  <input className="input" name="room" defaultValue={asg ? `Ruang ${asg.class.name}` : ""} style={{ minHeight: 44 }} />
                </div>
                <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }}>+ Tambah Jam</button>
              </form>
            </div>
          </div>
        )}

        <WeekView rows={rows} today={today} showInactive={user.role === "ADMIN"} />
        {user.role === "ADMIN" && rows.length > 0 && (
          <div className="card">
            <div className="card-head"><h2>Nonaktifkan / Aktifkan Baris Jadwal</h2></div>
            <div className="card-body">
              <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                Jadwal yang punya riwayat presensi DINONAKTIFKAN (riwayat aman), bukan dihapus.
                Jadwal tanpa sesi bisa dihapus fisik bila perlu.
              </p>
              {rows.map((s) => (
                <div key={String(s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8, padding: "6px 0", borderBottom: "1px dashed var(--ink)" }}>
                  <span className="pill" style={{ minHeight: 36, display: "inline-flex", alignItems: "center" }}>
                    {DAYS[s.day]} : {s.startTime} – {s.endTime} {s.room ? `(${s.room})` : ""}
                    {(s as { isActive?: boolean }).isActive === false && " ⏸️ NONAKTIF"}
                  </span>
                  {(s as { isActive?: boolean }).isActive === false ? (
                    <form action={activateSchedule}>
                      <input type="hidden" name="id" value={String(s.id)} />
                      <input type="hidden" name="assignmentId" value={a} />
                      <button className="btn btn-sm btn-green btn-block-mobile" type="submit">▶️ Aktifkan</button>
                    </form>
                  ) : (
                    <DangerSubmit action={deleteSchedule} hidden={{ id: String(s.id), assignmentId: a }} confirmText="Nonaktifkan baris jadwal ini? (riwayat presensi tetap aman)" btnClass="btn btn-sm btn-block-mobile">⏸️ Nonaktifkan</DangerSubmit>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  // ── 2. TAMPILAN ROLE ORTU ──
  if (user.role === "ORTU") {
    const parentLinks = await prisma.parentLink.findMany({
      where: { parentId: user.id },
      include: { child: { include: { classRef: { select: { name: true } } } } },
    });
    if (!parentLinks.length) {
      return (
        <AppShell user={user} active="/jadwal">
          <div className="breadcrumb">
            <Link href="/dashboard">Beranda</Link>
            <span className="sep">&gt;</span>
            <span className="current">Jadwal Pelajaran</span>
          </div>
          <div className="empty">Belum ada data siswa yang terhubung dengan akun Anda.</div>
        </AppShell>
      );
    }
    const activeChildId = rawChildId ? BigInt(rawChildId) : parentLinks[0]?.childId;
    const currentChild = parentLinks.find((l) => l.childId === activeChildId)?.child ?? parentLinks[0]?.child;
    const clsId = currentChild.classId;
    const assigns = clsId ? await classAssignments([clsId], semesterId) : [];
    const rows = await loadSchedules({ id: { in: assigns.map((x) => x.id) } });

    return (
      <AppShell user={user} active="/jadwal">
        <div className="breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span className="sep">&gt;</span>
          <span className="current">Jadwal Pelajaran</span>
        </div>
        <div className="page-head">
          <h1>Jadwal Pelajaran: {currentChild?.nama ?? "Anak"}</h1>
          <p>
            {clsId
              ? `Jadwal tatap muka mingguan kelas ${currentChild.classRef?.name ?? ""} di SMPN 5 Tegal.`
              : "Kelas belum ditautkan — hubungi admin sekolah."}
          </p>
        </div>

        {parentLinks.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {parentLinks.map((l) => (
              <Link
                key={String(l.childId)}
                className={`pill ${l.childId === currentChild?.id ? "hl" : ""}`}
                href={`/jadwal?childId=${l.childId}`}
                style={{ padding: "8px 14px", minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
              >
                👦 {l.child.nama}
              </Link>
            ))}
          </div>
        )}

        <WeekView rows={rows} today={today} />
      </AppShell>
    );
  }

  // ── 3. TAMPILAN ROLE SISWA ──
  if (user.role === "SISWA") {
    const clsId = await studentClassId(user.id);
    const assigns = clsId ? await classAssignments([clsId], semesterId) : [];
    const rows = await loadSchedules({ id: { in: assigns.map((x) => x.id) } });
    return (
      <AppShell user={user} active="/jadwal">
        <div className="breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span className="sep">&gt;</span>
          <span className="current">Jadwal Pelajaran</span>
        </div>
        <div className="page-head">
          <h1>Jadwal Mingguan</h1>
          <p>{clsId ? "Jadwal mingguan kelasmu." : "Kelas belum ditautkan — hubungi admin."}</p>
        </div>
        <WeekView rows={rows} today={today} />
      </AppShell>
    );
  }

  // ── 4. TAMPILAN ROLE GURU ──
  if (user.role === "GURU") {
    const my = await teacherAssignments(user.id, semesterId);
    const rows = await loadSchedules({ id: { in: my.map((x) => x.id) } });
    return (
      <AppShell user={user} active="/jadwal">
        <div className="breadcrumb">
          <Link href="/dashboard">Beranda</Link>
          <span className="sep">&gt;</span>
          <span className="current">Jadwal Mengajar</span>
        </div>
        <div className="page-head">
          <h1>Jadwal Mengajar</h1>
          <p>Jadwal tatap muka mingguan untuk {my.length} kelas yang Anda ajar pada semester ini.</p>
        </div>
        <WeekView rows={rows} today={today} />
      </AppShell>
    );
  }

  // ── 5. TAMPILAN ROLE ADMIN & KEPSEK (JADWAL MASTER SELURUH GURU & ROMBEL) ──
  const [allClasses, allTeachers] = await Promise.all([
    prisma.class.findMany({
      where: { ...(semesterId && ctx ? { academicYearId: ctx.year.id } : {}) },
      orderBy: [{ tingkat: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "GURU", isActive: true, deletedAt: null },
      select: {
        id: true,
        nama: true,
        kode: true,
        username: true,
        assignments: {
          include: {
            subject: { select: { name: true, code: true } },
            class: { select: { name: true } },
            _count: { select: { schedules: true } },
          },
        },
      },
      orderBy: { kode: "asc" },
    }),
  ]);

  // Urutkan guru secara numerik berdasarkan kodenya (1..32)
  allTeachers.sort((a, b) => {
    const ka = Number(a.kode || 999);
    const kb = Number(b.kode || 999);
    return ka - kb;
  });

  const selectedDay = rawDay ? Number(rawDay) : (today >= 1 && today <= 6 ? today : 1);

  // Ambil Jadwal Matriks untuk Hari Terpilih
  const daySchedules = tab === "matriks"
    ? await prisma.schedule.findMany({
        where: { day: selectedDay },
        include: {
          assignment: {
            include: {
              class: { select: { name: true } },
              subject: { select: { name: true, code: true } },
              teacher: { select: { id: true, nama: true, kode: true } },
            },
          },
        },
      })
    : [];

  // Indexing cell: `${startTime}-${className}` -> { subject, teacher }
  const matrixMap = new Map<string, { subject: string; code: string; teacher: string; teacherKode: string | null }>();
  for (const s of daySchedules) {
    const key = `${s.startTime}-${s.assignment.class.name}`;
    matrixMap.set(key, {
      subject: s.assignment.subject.name,
      code: s.assignment.subject.code,
      teacher: s.assignment.teacher?.nama ?? "—",
      teacherKode: s.assignment.teacher?.kode ?? null,
    });
  }

  // Data untuk Tab Guru Terpilih
  const selectedTeacherId = guruId ? BigInt(guruId) : allTeachers[0]?.id;
  const currentTeacher = allTeachers.find((t) => t.id === selectedTeacherId) ?? allTeachers[0];
  const teacherRows = tab === "guru" && currentTeacher
    ? await loadSchedules({ teacherId: currentTeacher.id })
    : [];

  // Hitung total jam mengajar guru terpilih
  const totalTeacherHours = teacherRows.length;

  // Data untuk Tab Rombel Terpilih
  const selectedClassId = rawClassId ? BigInt(rawClassId) : allClasses[0]?.id;
  const currentClass = allClasses.find((c) => c.id === selectedClassId) ?? allClasses[0];
  const classRows = tab === "rombel" && currentClass
    ? await loadSchedules({ classId: currentClass.id })
    : [];

  const timeline = DAY_TIMELINES[selectedDay] ?? [];

  return (
    <AppShell user={user} active="/jadwal">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">JADWAL PEMBELAJARAN</span>
      </nav>

      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Jadwal Belajar</h1>
          <p>
            Semester I (Satu) Tahun Pelajaran 2026-2027 · SMP Negeri 5 Tegal. Memantau jam tatap muka seluruh guru dan rombel.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/api/templates/jadwal" download className="btn btn-sm btn-yellow btn-block-mobile" style={{ textDecoration: "none" }}>
            📋 Unduh Template CSV
          </a>
        </div>
      </div>

      {msg && <div className="alert alert-success">✓ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">✕ {decodeURIComponent(err)}</div>}
      {done && (
        <div className="alert alert-info" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <span><b>Hasil Impor CSV Jadwal:</b></span>
          <span className="badge badge-green">✓ Ditambahkan: {created ?? 0}</span>
          <span className="badge badge-yellow">ℹ Sudah Ada: {existing ?? 0}</span>
          {Number(skipped) > 0 && <span className="badge badge-red">✕ Gagal: {skipped}</span>}
        </div>
      )}

      {/* QUICK STATS BANNER — 2 kolom di layar sempit agar tidak meluber */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div>
            <div className="stat-label">TOTAL ROMBEL</div>
            <div className="stat-value">{allClasses.length} Kelas</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Kelas VII, VIII, dan IX (A–F)</div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-label">TOTAL GURU</div>
            <div className="stat-value">{allTeachers.length} Guru</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Kode Guru 1 s/d 32</div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-label">HARI INI</div>
            <div className="stat-value">{DAYS[today]}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Jadwal aktif semester I</div>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="stat-label">TOTAL SLOT JAM</div>
            <div className="stat-value">756 Jam</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Tatap muka mingguan</div>
          </div>
        </div>
      </div>

      {/* CARD IMPOR MASSAL JADWAL */}
      {user.role === "ADMIN" && (
        <details className="card" style={{ marginBottom: 20, cursor: "pointer" }}>
          <summary style={{ padding: "12px 16px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span>📥 Form Impor Massal Jadwal Pelajaran (CSV)</span>
            <span className="pill" style={{ flexShrink: 0 }}>Buka/Tutup</span>
          </summary>
          <div className="card-body" style={{ borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: 14 }}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Unggah file CSV dengan kolom: <code>hari,jam_mulai,jam_selesai,rombel,mapel,guru,ruang</code>
              <br />
              Contoh: <code>Senin,07:40,08:15,7A,PJOK,guru09,Ruang 7A</code>
            </p>
            <form action={importBulkAction} encType="multipart/form-data" className="import-form">
              <input type="hidden" name="kind" value="jadwal" />
              <input type="hidden" name="redirectUrl" value="/jadwal" />
              <input className="input" type="file" name="file" accept=".csv,text/csv" required style={{ minHeight: 38, minWidth: 0 }} />
              <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 38, whiteSpace: "nowrap" }}>
                📤 Unggah &amp; Impor Jadwal
              </button>
            </form>
          </div>
        </details>
      )}

      {/* MODE TAMPILAN JADWAL TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid var(--border, #e2e8f0)", paddingBottom: 8, flexWrap: "wrap" }}>
        <Link
          href={`/jadwal?tab=matriks&day=${selectedDay}`}
          className={`pill ${tab === "matriks" ? "hl" : ""}`}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: tab === "matriks" ? 700 : 500, textDecoration: "none" }}
        >
          📅 Matriks Jadwal Per Hari
        </Link>
        <Link
          href={`/jadwal?tab=guru${currentTeacher ? `&guruId=${currentTeacher.id}` : ""}`}
          className={`pill ${tab === "guru" ? "hl" : ""}`}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: tab === "guru" ? 700 : 500, textDecoration: "none" }}
        >
          👨‍🏫 Jadwal &amp; Jam Seluruh Guru
        </Link>
        <Link
          href={`/jadwal?tab=rombel${currentClass ? `&classId=${currentClass.id}` : ""}`}
          className={`pill ${tab === "rombel" ? "hl" : ""}`}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: tab === "rombel" ? 700 : 500, textDecoration: "none" }}
        >
          🏫 Jadwal Per Rombel
        </Link>
      </div>

      {/* ── TAB 1: MATRIKS JADWAL PER HARI ── */}
      {tab === "matriks" && (
        <div className="card">
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2>Matriks Pembelajaran: {DAYS[selectedDay]}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Peta jam tatap muka 18 rombel kelas VII, VIII, dan IX</span>
            </div>

            {/* Pilihan Hari */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <Link
                  key={d}
                  href={`/jadwal?tab=matriks&day=${d}`}
                  className={`pill ${selectedDay === d ? "hl" : ""}`}
                  style={{ textDecoration: "none", fontSize: 13, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {DAYS[d]}
                  {d === today && <span className="badge badge-green" style={{ fontSize: 9, padding: "2px 4px" }}>HARI INI</span>}
                </Link>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-matrix" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th className="sticky-col" style={{ width: 52, textAlign: "center", verticalAlign: "middle" }} rowSpan={2}>Jam</th>
                  <th className="sticky-col" style={{ width: 104, verticalAlign: "middle" }} rowSpan={2}>Waktu</th>
                  <th colSpan={6} style={{ textAlign: "center", background: "#e0e7ff", color: "#1e3a8a", borderRight: "2px solid #cbd5e1" }}>
                    KELAS VII
                  </th>
                  <th colSpan={6} style={{ textAlign: "center", background: "#fef3c7", color: "#92400e", borderRight: "2px solid #cbd5e1" }}>
                    KELAS VIII
                  </th>
                  <th colSpan={6} style={{ textAlign: "center", background: "#dcfce7", color: "#166534" }}>
                    KELAS IX
                  </th>
                </tr>
                <tr>
                  {ORDERED_CLASSES.map((cName, idx) => (
                    <th
                      key={cName}
                      style={{
                        textAlign: "center",
                        width: 75,
                        background: cName.startsWith("7") ? "#eef2ff" : cName.startsWith("8") ? "#fffbeb" : "#f0fdf4",
                        borderRight: idx === 5 || idx === 11 ? "2px solid #cbd5e1" : undefined,
                      }}
                    >
                      <b>{cName}</b>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((slot, sIdx) => {
                  if (slot.type === "break") {
                    return (
                      <tr key={`break-${sIdx}`} style={{ background: "#f8fafc" }}>
                        <td className="sticky-col" style={{ textAlign: "center", color: "#94a3b8" }}>—</td>
                        <td className="sticky-col" style={{ fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{slot.time}</td>
                        <td colSpan={18} style={{ textAlign: "center", fontWeight: 700, letterSpacing: 0.8, color: "#475569", padding: "8px 12px" }}>
                          ☕ {slot.label}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`lesson-${sIdx}`}>
                      <td className="sticky-col" style={{ textAlign: "center" }}>
                        <span className="badge badge-yellow" style={{ fontSize: 11, fontWeight: 700 }}>
                          {slot.jamKe}
                        </span>
                      </td>
                      <td className="sticky-col" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{slot.time}</td>
                      {ORDERED_CLASSES.map((cName, cIdx) => {
                        const cellData = matrixMap.get(`${slot.start}-${cName}`);
                        return (
                          <td
                            key={cName}
                            style={{
                              padding: "6px 8px",
                              verticalAlign: "top",
                              borderRight: cIdx === 5 || cIdx === 11 ? "2px solid #cbd5e1" : undefined,
                            }}
                          >
                            {cellData ? (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-primary, #1e3a8a)", lineHeight: 1.2 }}>
                                  {cellData.code || cellData.subject}
                                </div>
                                <div
                                  style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 85 }}
                                  title={`${cellData.teacherKode ? `[${cellData.teacherKode}] ` : ""}${cellData.teacher} (${cellData.subject})`}
                                >
                                  {cellData.teacherKode ? `[${cellData.teacherKode}] ` : ""}
                                  {cellData.teacher.split(",")[0]}
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: "center", color: "#cbd5e1" }}>—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: JADWAL & JAM SELURUH GURU ── */}
      {tab === "guru" && (
        <>
          {/* PEMILIH GURU */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-head">
              <h2>Pilih Guru untuk Melihat Rincian Jam</h2>
            </div>
            <div className="card-body">
              <form method="get" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="tab" value="guru" />
                <div style={{ flex: "1 1 320px" }}>
                  <select
                    className="input"
                    name="guruId"
                    defaultValue={String(currentTeacher?.id ?? "")}
                    style={{ minHeight: 42, width: "100%", fontSize: 14 }}
                  >
                    {allTeachers.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        [{t.kode || "—"}] {t.nama} — {t.assignments[0]?.subject.name ?? "Mapel"} ({t.assignments.map(a => a.class.name).join(", ")})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit" style={{ minHeight: 42 }}>
                  Tampilkan Jadwal Guru
                </button>
              </form>
            </div>
          </div>

          {currentTeacher && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 18 }}>
                    [{currentTeacher.kode}] {currentTeacher.nama}
                  </h2>
                  <div className="meta" style={{ marginTop: 2 }}>
                    Mata Pelajaran: <b>{currentTeacher.assignments[0]?.subject.name ?? "—"}</b> · Kelas yang diampu: {currentTeacher.assignments.map(a => a.class.name).join(", ") || "—"}
                  </div>
                </div>
                <span className="badge badge-green" style={{ fontSize: 14, padding: "6px 12px" }}>
                  Total: {totalTeacherHours} Jam Tatap Muka / Minggu
                </span>
              </div>
              <WeekView rows={teacherRows} today={today} />
            </div>
          )}

          {/* REKAPITULASI BEBAN MENGAJAR SELURUH 32 GURU */}
          <div className="card">
            <div className="card-head">
              <h2>Rekapitulasi Jam Mengajar Seluruh Guru ({allTeachers.length} Guru)</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60, textAlign: "center" }}>Kode</th>
                    <th>Nama Guru</th>
                    <th>Mata Pelajaran</th>
                    <th>Rombel yang Diampu</th>
                    <th style={{ width: 140, textAlign: "center" }}>Total Jam / Minggu</th>
                    <th style={{ width: 110, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allTeachers.map((t) => {
                    const totalJam = t.assignments.reduce((sum, a) => sum + a._count.schedules, 0);
                    const mapelName = t.assignments[0]?.subject.name ?? "—";
                    const rombels = Array.from(new Set(t.assignments.map((a) => a.class.name))).join(", ") || "—";
                    const isSelected = t.id === currentTeacher?.id;
                    return (
                      <tr key={String(t.id)} style={{ background: isSelected ? "#f0fdf4" : undefined }}>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-blue"><b>{t.kode || "—"}</b></span>
                        </td>
                        <td>
                          <b>{t.nama}</b>
                        </td>
                        <td>{mapelName}</td>
                        <td><small className="muted">{rombels}</small></td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-yellow" style={{ fontWeight: 700 }}>
                            {totalJam} Jam
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/jadwal?tab=guru&guruId=${t.id}`} className="btn btn-sm btn-neutral">
                            Lihat Jadwal
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 3: JADWAL PER ROMBEL ── */}
      {tab === "rombel" && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-head">
              <h2>Pilih Rombel / Kelas</h2>
            </div>
            <div className="card-body">
              <form method="get" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="tab" value="rombel" />
                <div style={{ flex: "1 1 240px" }}>
                  <select
                    className="input"
                    name="classId"
                    defaultValue={String(currentClass?.id ?? "")}
                    style={{ minHeight: 42, width: "100%", fontSize: 14 }}
                  >
                    {allClasses.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        Kelas {c.name} (Tingkat {c.tingkat})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit" style={{ minHeight: 42 }}>
                  Tampilkan Jadwal Rombel
                </button>
              </form>
            </div>
          </div>

          {currentClass && (
            <div className="card">
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <h2>Jadwal Mingguan: Kelas {currentClass.name}</h2>
                <span className="badge badge-blue">{classRows.length} Jam Tatap Muka / Minggu</span>
              </div>
              <WeekView rows={classRows} today={today} />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
