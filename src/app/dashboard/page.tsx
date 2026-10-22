import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester, classAssignments, studentClassId, childrenOfClassIds, teacherAssignments } from "@/lib/academic";
import { DAYS } from "@/lib/notify";
import { NAV } from "@/lib/nav";
import AppShell from "@/components/app-shell";

const MODULES: { nama: string; href: string; desc: string; icon: string; status: string; roles: string[] }[] = [
  { nama: "Presensi", href: "/presensi", desc: "Isi absensi sesi mengajar hari ini", icon: "✅", status: "PRESENSI", roles: ["GURU", "ADMIN"] },
  { nama: "Tujuan Pembelajaran", href: "/tp", desc: "Susun TP per kelas selaras e-Rapor", icon: "🎯", status: "LMS", roles: ["GURU", "ADMIN"] },
  { nama: "Materi Belajar", href: "/materi", desc: "Akses bahan ajar & modul", icon: "📖", status: "LMS", roles: ["GURU", "SISWA", "ORTU", "KEPSEK"] },
  { nama: "Tugas Siswa", href: "/tugas", desc: "Kumpulkan tugas & pantau nilai", icon: "📝", status: "LMS", roles: ["GURU", "SISWA"] },
  { nama: "Rekap Nilai TP", href: "/nilai", desc: "Ketercapaian TP & capaian rapor", icon: "📊", status: "LMS", roles: ["GURU", "SISWA", "ORTU", "KEPSEK"] },
  { nama: "Jadwal Pelajaran", href: "/jadwal", desc: "Jadwal pelajaran hari ini & pekan", icon: "🗓️", status: "TERPADU", roles: ["GURU", "SISWA", "ORTU", "KEPSEK", "ADMIN"] },
  { nama: "MPI Edukasi", href: "/mpi", desc: "Game interaktif & media belajar", icon: "🎮", status: "GAME", roles: ["GURU", "SISWA", "KEPSEK"] },
  { nama: "Ujian CBT", href: "/ujian", desc: "Platform asesmen & tes formatif", icon: "📋", status: "CBT", roles: ["GURU", "SISWA", "ORTU", "ADMIN"] },
  { nama: "Kehadiran", href: "/rekap-presensi", desc: "Pantau rekap kehadiran belajar", icon: "📅", status: "PRESENSI", roles: ["SISWA", "ORTU", "KEPSEK"] },
  { nama: "Kelola Akun", href: "/admin/akun/siswa", desc: "Kelola akun siswa, guru, rombel, & ortu", icon: "👥", status: "ADMIN", roles: ["ADMIN"] },
  { nama: "Penugasan Mengajar", href: "/admin/penugasan", desc: "Penugasan guru, wali kelas, & mapel", icon: "📋", status: "ADMIN", roles: ["ADMIN"] },
  { nama: "Jadwal Pelajaran", href: "/jadwal", desc: "Kelola & impor jadwal pelajaran", icon: "🗓️", status: "ADMIN", roles: ["ADMIN"] },
  { nama: "Pengumuman", href: "/pengumuman", desc: "Warta & agenda penting sekolah", icon: "📢", status: "INFO", roles: ["GURU", "SISWA", "ORTU", "KEPSEK", "ADMIN"] },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const ctx = await currentSemester();
  const today = new Date().getDay();

  let dayRows: { id: bigint; start: string; end: string; room: string | null; subject: string; className: string; teacherName: string | null }[] = [];
  let latestAnnouncements: { id: bigint; judul: string; createdAt: Date; target: string; className: string | null }[] = [];
  try {
    let classIds: bigint[] = [];
    let assignIds: bigint[] | null = null;
    if (user.role === "SISWA") { const c = await studentClassId(user.id); classIds = c ? [c] : []; }
    else if (user.role === "ORTU") classIds = await childrenOfClassIds(user.id);
    else if (user.role === "GURU") {
      const my = await teacherAssignments(user.id, ctx?.semester.id);
      assignIds = my.map((m) => m.id);
      classIds = [];
    }
    let ids = assignIds ?? [];
    if (assignIds === null) {
      const asgs = await classAssignments(classIds, ctx?.semester.id);
      ids = asgs.map((x) => x.id);
    }
    if (ids.length) {
      const sched = await prisma.schedule.findMany({
        where: { day: today, assignmentId: { in: ids } },
        include: { assignment: { include: { subject: true, class: true, teacher: { select: { nama: true } } } } },
        orderBy: { startTime: "asc" },
      });
      dayRows = sched.map((s) => ({
        id: s.id, start: s.startTime, end: s.endTime, room: s.room,
        subject: s.assignment.subject.name, className: s.assignment.class.name,
        teacherName: s.assignment.teacher?.nama ?? null,
      }));
    }
    const anns = await prisma.announcement.findMany({
      where: {
        deletedAt: null,
        ...(user.role === "SISWA" || user.role === "ORTU"
          ? { OR: [{ target: "SEMUA" }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])] }
          : { target: "SEMUA" }),
      },
      include: { class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    latestAnnouncements = anns.map((p) => ({ id: p.id, judul: p.judul, createdAt: p.createdAt, target: p.target, className: p.class?.name ?? null }));
  } catch { /* ignore fallback */ }

  const [counts, assignments] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    user.role === "GURU"
      ? prisma.assignment.count({ where: { teacherId: user.id } })
      : Promise.resolve(0),
  ]);
  const totalUser = counts.reduce((s, c) => s + c._count._all, 0);

  let guruSum: { pending: number; lewat: { id: bigint; judul: string; cls: string; due: Date }[]; dekat: { id: bigint; judul: string; cls: string; due: Date }[]; punyaRombel: boolean } | null = null;
  if (user.role === "GURU") {
    try {
      const now = Date.now();
      const tasks = await prisma.task.findMany({
        where: {
          status: "TERBIT", deletedAt: null,
          assignment: { teacherId: user.id, ...(ctx ? { semesterId: ctx.semester.id } : {}) },
          dueAt: { gt: new Date(now - 30 * 86_400_000), lt: new Date(now + 3 * 86_400_000) },
        },
        include: {
          _count: { select: { submissions: true } },
          assignment: { select: { class: { select: { name: true, _count: { select: { members: true } } } } } },
        },
        orderBy: { dueAt: "asc" },
      });
      const pending = await prisma.submission.count({
        where: { grades: { none: {} }, task: { status: "TERBIT", deletedAt: null, assignment: { teacherId: user.id } } },
      });
      const lewat = tasks
        .filter((t) => +t.dueAt < now && t._count.submissions < (t.assignment.class?._count?.members ?? 999))
        .map((t) => ({ id: t.id, judul: t.judul, cls: t.assignment.class.name, due: t.dueAt }));
      const dekat = tasks
        .filter((t) => +t.dueAt >= now)
        .map((t) => ({ id: t.id, judul: t.judul, cls: t.assignment.class.name, due: t.dueAt }));
      guruSum = { pending, lewat, dekat, punyaRombel: assignments > 0 };
    } catch { /* ignore */ }
  }

  return (
    <AppShell user={user} active="/dashboard">
      <div className="page-head">
        <h1 style={{ textTransform: "none" }}>Halo, {user.nama.split(",")[0]}</h1>
        {user.role === "ADMIN" && (
          <p>Total akun terdaftar: <strong>{totalUser}</strong>. <a href="/admin/akun/siswa">Kelola akun →</a></p>
        )}
        {user.role === "GURU" && (
          <p>
            {assignments > 0
              ? `Anda mengampu ${assignments} kelas mata pelajaran pada semester ini.`
              : "Belum ada kelas mengajar — hubungi admin."}
          </p>
        )}
      </div>

      {guruSum && (guruSum.pending > 0 || guruSum.lewat.length > 0 || guruSum.dekat.length > 0 || !guruSum.punyaRombel) && (
        <div className="card">
          <div className="card-head"><h2>Perlu perhatian</h2><a className="pill" href="/tugas">ke Tugas →</a></div>
          <div className="card-body">
            {!guruSum.punyaRombel && (
              <p className="alert alert-error" style={{ marginBottom: 10 }}>
                Belum ada kelas mengajar — hubungi admin.
              </p>
            )}
            {guruSum.pending > 0 && (
              <p style={{ marginBottom: 8 }}>
                <a className="badge badge-yellow" href="/tugas" style={{ textDecoration: "none" }}>
                  ✍ {guruSum.pending} pengumpulan tugas menunggu dinilai
                </a>
              </p>
            )}
            {guruSum.lewat.length > 0 && (
              <>
                <p className="muted" style={{ fontWeight: 800 }}>Tenggat lewat, masih ada siswa belum kumpul:</p>
                {guruSum.lewat.slice(0, 5).map((t) => (
                  <div className="muted" key={String(t.id)}>• <a href={`/tugas?t=${t.id}`}>{t.judul}</a> — {t.cls} · lewat {new Date(t.due).toLocaleDateString("id-ID")}</div>
                ))}
              </>
            )}
            {guruSum.dekat.length > 0 && (
              <>
                <p className="muted" style={{ fontWeight: 800, marginTop: 8 }}>Tenggat dekat (≤ 3 hari):</p>
                {guruSum.dekat.slice(0, 5).map((t) => (
                  <div className="muted" key={String(t.id)}>• <a href={`/tugas?t=${t.id}`}>{t.judul}</a> — {t.cls} · {new Date(t.due).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {user.role === "ADMIN" && (
        <div className="stat-grid">
          {counts.map((c) => (
            <div className="stat" key={c.role}>
              <span className="stat-icon">👤</span>
              <div>
                <div className="stat-value">{c._count._all}</div>
                <div className="stat-label">{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dayRows.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Jadwal hari ini ({DAYS[today]})</h2>
            <a className="pill" href="/jadwal">seminggu →</a>
          </div>
          <div className="card-body">
            {dayRows.map((s) => (
              <div className="list-row" key={String(s.id)} style={{ marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <b>{s.subject}</b> <span className="muted">{s.start}–{s.end}{s.room ? ` · ${s.room}` : ""}</span>
                  <div className="meta">{s.className} · {s.teacherName ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {latestAnnouncements.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Pengumuman terbaru</h2><a className="pill" href="/pengumuman">semua →</a></div>
          <div className="card-body">
            {latestAnnouncements.map((p) => (
              <div className="muted" key={String(p.id)} style={{ marginBottom: 6 }}>
                📢 <a href="/pengumuman"><b>{p.judul}</b></a>{" "}
                <span style={{ fontSize: 12 }}>· {p.target === "SEMUA" ? "seluruh sekolah" : p.className ?? ""} · {new Date(p.createdAt).toLocaleDateString("id-ID")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 12px" }}>
        <h2 style={{ margin: 0 }}>Modul</h2>
        <span className="pill">{user.role}</span>
      </div>
      <nav className="card modul-list" aria-label="Modul portal" style={{ margin: 0 }}>
        {(() => {
          const userNav = NAV[user.role] ?? [];
          const navOrder = new Map(userNav.map((n, i) => [n.href, i]));
          if (user.role === "ADMIN") {
            const adminUjianIdx = userNav.findIndex((n) => n.href === "/admin/ujian");
            if (adminUjianIdx !== -1) navOrder.set("/ujian", adminUjianIdx);
          }
          const seen = new Set<string>();
          const userModules = MODULES.filter((m) => {
            if (!m.roles.includes(user.role) || seen.has(m.href)) return false;
            seen.add(m.href);
            return true;
          }).sort((a, b) => {
            const ordA = navOrder.has(a.href) ? navOrder.get(a.href)! : 999;
            const ordB = navOrder.has(b.href) ? navOrder.get(b.href)! : 999;
            return ordA - ordB;
          });
          return userModules.map((m) => (
            <a className="modul-row" key={m.href} href={m.href}>
              <span className="modul-ico" aria-hidden="true">{m.icon}</span>
              <span className="modul-text">
                <b>{m.nama}</b>
                <small className="muted">{m.desc}</small>
              </span>
              <span className="modul-go" aria-hidden="true">›</span>
            </a>
          ));
        })()}
      </nav>
    </AppShell>
  );
}
