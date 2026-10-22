import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSemester, studentClassId, childrenOfClassIds, teacherAssignments } from "@/lib/academic";
import AppShell from "@/components/app-shell";
import DangerSubmit from "@/components/danger-submit";
import { createAnnouncement, deleteAnnouncement } from "./actions";

export default async function PengumumanPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  const { err } = await searchParams;

  // kelas yg relevan utk pembacaan
  let myClassIds: bigint[] = [];
  if (user.role === "SISWA") {
    const c = await studentClassId(user.id);
    myClassIds = c ? [c] : [];
  } else if (user.role === "ORTU") {
    myClassIds = await childrenOfClassIds(user.id);
  }

  const items = await prisma.announcement.findMany({
    where: {
      deletedAt: null,
      ...(user.role === "SISWA" || user.role === "ORTU"
        ? { OR: [{ target: "SEMUA" }, ...(myClassIds.length ? [{ classId: { in: myClassIds } }] : [])] }
        : {}),
    },
    include: { class: true, author: { select: { nama: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // opsi kelas utk pembuat
  let kelasOptions: { id: bigint; name: string }[] = [];
  if (user.role === "ADMIN") {
    const ctx = await currentSemester();
    const cls = await prisma.class.findMany({
      where: { ...(ctx ? { academicYearId: ctx.year.id } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    kelasOptions = cls;
  } else if (user.role === "GURU") {
    const ctx = await currentSemester();
    const my = await teacherAssignments(user.id, ctx?.semester.id);
    const seen = new Map<bigint, string>();
    for (const m of my) seen.set(m.classId, m.class.name);
    // + rombel yg ia wali
    const wali = await prisma.class.findMany({ where: { homeroomUserId: user.id }, select: { id: true, name: true } });
    for (const w of wali) seen.set(w.id, w.name);
    kelasOptions = [...seen.entries()].map(([id, name]) => ({ id, name }));
  }

  const canPost = ["ADMIN", "GURU"].includes(user.role);

  return (
    <AppShell user={user} active="/pengumuman">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">Pengumuman</span>
      </div>
      <div className="page-head">
        <h1>Pengumuman Sekolah</h1>
        <p className="muted">{user.role === "SISWA" || user.role === "ORTU" ? "Informasi resmi sekolah dan agenda belajar rombel kelasmu." : "Pusat informasi dan edaran resmi civitas akademika SMPN 5 Tegal."}</p>
      </div>

      {canPost && (
        <div className="card">
          <div className="card-head"><h2>➕ Buat Pengumuman Baru</h2></div>
          <div className="card-body">
            {err && <p className="error">Judul &amp; isi pengumuman wajib diisi.</p>}
            <form action={createAnnouncement}>
              <div className="field">
                <label className="field-label">Judul Pengumuman</label>
                <input className="input" name="judul" placeholder="mis. Jadwal Asesmen Sumatif Tengah Semester Genap" required style={{ minHeight: 44 }} />
              </div>
              <div className="field">
                <label className="field-label">Isi Pengumuman Lengkap</label>
                <textarea className="input" name="isi" rows={4} placeholder="Tuliskan isi pengumuman atau instruksi penting kepada warga sekolah…" required style={{ minHeight: 88 }} />
              </div>
              <div className="field" style={{ maxWidth: 420 }}>
                <label className="field-label">
                  Sasaran Penerima {user.role === "GURU" ? "(Pilih Rombel Binaanmu)" : ""}
                </label>
                <select className="input" name="classId" defaultValue={user.role === "GURU" ? "" : "0"} style={{ minHeight: 44 }}>
                  {user.role === "ADMIN" && <option value="0">📣 Seluruh Sekolah (Semua Pengguna)</option>}
                  {user.role === "GURU" && <option value="">— Pilih Rombel Binaan —</option>}
                  {kelasOptions.map((k) => (
                    <option key={String(k.id)} value={String(k.id)}>Rombel Kelas {k.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  📢 Publikasikan Pengumuman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {items.map((p) => (
        <div className="card" key={String(p.id)}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>{p.judul}</h2>
            <span className={`badge ${p.target === "SEMUA" ? "badge-yellow" : "badge-blue"}`}>
              {p.target === "SEMUA" ? "SEMUA PENGGUNA" : `KELAS ${p.class?.name ?? "ROMBEL"}`}
            </span>
          </div>
          <div className="card-body">
            <p className="prose" style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>{p.isi}</p>
            <div className="meta" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span>✍ Penulis: <b>{p.author.nama}</b> ({p.author.role})</span>
              <span>· 📅 {new Date(p.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            {(user.role === "ADMIN" || p.authorId === user.id) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--ink)", display: "flex", justifyContent: "flex-end" }}>
                <DangerSubmit action={deleteAnnouncement} hidden={{ id: String(p.id) }} confirmText={`Hapus pengumuman "${p.judul}"?`} btnClass="btn btn-danger btn-sm btn-block-mobile">
                  🗑 Hapus Pengumuman
                </DangerSubmit>
              </div>
            )}
          </div>
        </div>
      ))}
      {!items.length && <div className="empty">Belum ada pengumuman yang dipublikasikan.</div>}
    </AppShell>
  );
}
