import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import { addSoal, deleteSoal, addSubject } from "./actions";

export default async function MpiBankPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const user = await requireRole(["GURU", "ADMIN"]);
  const { game: gameFilter } = await searchParams;

  const games = await prisma.mpiGame.findMany({
    where: { aktif: true },
    orderBy: { urutan: "asc" },
  });
  const subjects = await prisma.mpiSubject.findMany({ orderBy: { name: "asc" } });

  const soal = await prisma.mpiQuestion.findMany({
    where: {
      ...(gameFilter ? { game: { slug: gameFilter } } : {}),
      ...(user.role === "GURU" ? { OR: [{ ownerId: user.id }, { isDemo: true }] } : {}),
    },
    include: { game: true, mpiSubject: true },
    orderBy: { id: "desc" },
    take: 100,
  });

  return (
    <AppShell user={user} active="/mpi">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <a href="/mpi">MPI Edukasi</a>
        <span className="sep">&gt;</span>
        <span className="current">Bank Soal</span>
      </div>
      <div className="page-head">
        <h1>Bank Soal MPI 📚</h1>
        <p>Kelola soal guru per game. Soal dikoreksi server — kunci tidak pernah ke browser siswa.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Filter Game</h2></div>
        <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className={`pill ${!gameFilter ? "hl" : ""}`} href="/mpi/bank">Semua</a>
          {games.map((g) => (
            <a key={String(g.id)} className={`pill ${gameFilter === g.slug ? "hl" : ""}`} href={`/mpi/bank?game=${g.slug}`}>
              {g.icon} {g.nama}
            </a>
          ))}
        </div>
      </div>

      <div className="form-grid two">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head"><h2>➕ Tambah Soal</h2></div>
          <div className="card-body">
            <form action={addSoal} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select name="gameId" className="input" required style={{ minHeight: 44 }} defaultValue="">
                <option value="" disabled>Pilih game…</option>
                {games.map((g) => (
                  <option key={String(g.id)} value={String(g.id)}>{g.nama}</option>
                ))}
              </select>
              <textarea name="pertanyaan" className="input" rows={3} required placeholder="Tulis pertanyaan…" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input name="opsiA" className="input" placeholder="Opsi A" style={{ minHeight: 44 }} />
                <input name="opsiB" className="input" placeholder="Opsi B" style={{ minHeight: 44 }} />
                <input name="opsiC" className="input" placeholder="Opsi C" style={{ minHeight: 44 }} />
                <input name="opsiD" className="input" placeholder="Opsi D" style={{ minHeight: 44 }} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select name="answerKey" className="input" style={{ minHeight: 44, flex: "1 1 120px" }} defaultValue="A">
                  <option value="A">Kunci: A</option>
                  <option value="B">Kunci: B</option>
                  <option value="C">Kunci: C</option>
                  <option value="D">Kunci: D</option>
                </select>
                <select name="tingkat" className="input" style={{ minHeight: 44, flex: "1 1 140px" }} defaultValue="">
                  <option value="">Semua tingkat</option>
                  <option value="7">Kelas 7</option>
                  <option value="8">Kelas 8</option>
                  <option value="9">Kelas 9</option>
                </select>
                <select name="subjectId" className="input" style={{ minHeight: 44, flex: "1 1 140px" }} defaultValue="">
                  <option value="">Tanpa mapel</option>
                  {subjects.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
              <input name="explanation" className="input" placeholder="Penjelasan jawaban (opsional, tampil setelah koreksi)" style={{ minHeight: 44 }} />
              {user.role === "ADMIN" && (
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input type="checkbox" name="isDemo" value="1" /> Jadikan soal demo (bisa dipakai semua)
                </label>
              )}
              <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 48 }}>
                💾 Simpan Soal
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="card-head"><h2>📁 Mapel Bank Soal</h2></div>
          <div className="card-body">
            <form action={addSubject} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input name="name" className="input" placeholder="Nama mapel baru…" required style={{ minHeight: 44, flex: 1 }} />
              <button className="btn btn-sm btn-primary" type="submit" style={{ minHeight: 44 }}>Tambah</button>
            </form>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {subjects.length === 0 && <span className="muted">Belum ada mapel.</span>}
              {subjects.map((s) => (
                <span key={String(s.id)} className="pill">{s.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Daftar Soal ({soal.length})</h2></div>
        <div className="card-body">
          {soal.length === 0 && <div className="empty">Belum ada soal. Tambahkan lewat form di atas.</div>}
          {soal.map((s) => (
            <div key={String(s.id)} className="list-row" style={{ padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <b>{s.pertanyaan}</b>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {s.game.nama} · Kunci {s.answerKey}
                    {s.tingkat ? ` · Kelas ${s.tingkat}` : " · Semua tingkat"}
                    {s.mpiSubject ? ` · ${s.mpiSubject.name}` : ""}
                    {s.isDemo ? " · DEMO" : ""}
                  </div>
                </div>
                <form action={deleteSoal}>
                  <input type="hidden" name="id" value={String(s.id)} />
                  <button className="btn btn-sm" type="submit" style={{ minHeight: 40 }}>🗑️ Hapus</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
