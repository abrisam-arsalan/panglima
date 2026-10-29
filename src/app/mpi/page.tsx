import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/app-shell";
import MpiMain from "./main";

const DEFAULT_GAMES = [
  { slug: "clash-of-champions", title: "Clash of Champions", desc: "Kompetisi adu cepat menjawab kuis pengetahuan.", icon: "🏆", file: "clash-of-champions.html" },
  { slug: "edu-racing", title: "Edu Racing", desc: "Balapan mobil edukatif menjawab pertanyaan cepat.", icon: "🏎️", file: "edu-racing.html" },
  { slug: "famili-100", title: "Famili 100", desc: "Tebak jawaban teratas dari survei kelas.", icon: "👨‍👩‍👧‍👦", file: "famili-100.html" },
  { slug: "gesture-battle", title: "Gesture Battle", desc: "Tantangan interaktif dengan respon gerakan.", icon: "✋", file: "gesture-battle.html" },
  { slug: "kamera-benar-salah", title: "Kamera Benar / Salah", desc: "Deteksi pilihan jawaban menggunakan gestur kamera.", icon: "📷", file: "kamera-benar-salah.html" },
  { slug: "millionaire", title: "Who Wants to Be a Millionaire", desc: "Kuis bertingkat dengan bantuan 50:50 dan voting.", icon: "💰", file: "millionaire.html" },
  { slug: "mystery-box", title: "Mystery Box", desc: "Pilih kotak misterius berisi pertanyaan dan hadiah skor.", icon: "🎁", file: "mystery-box.html" },
  { slug: "snake-quiz", title: "Snake Quiz", desc: "Game ular klasik memakan jawaban yang tepat.", icon: "🐍", file: "snake-quiz.html" },
  { slug: "xxo-edukasi", title: "XXO Edukasi", desc: "Tic-Tac-Toe dengan soal pemikiran kritis di setiap giliran.", icon: "⭕", file: "xxo-edukasi.html" },
];

/**
 * Karakter panggung per game (hasil bedah 9 file HTML):
 * - ratio: aspek iframe arena (lihat CSS .mpi-arena.ratio-*)
 * - focus: porsi kolom soal vs arena di layar lebar
 * - keyboard: hint tombol yang didukung game HTML-nya
 * - tips: panduan singkat guru memakai game ini di IFP
 */
const STAGE: Record<string, { ratio: string; focus: "" | "arena-focus" | "soal-focus"; keyboard: string; pemain: string; tips: string }> = {
  "clash-of-champions": { ratio: "ratio-16-10", focus: "arena-focus", keyboard: "Klik/sentuh", pemain: "2–8 tim · rebutan", tips: "Buka papan di IFP, tunjuk juru bicara tiap tim. Bonus kecepatan membuat kelas riuh — siapkan aturan giliran." },
  "edu-racing": { ratio: "ratio-16-10", focus: "arena-focus", keyboard: "Klik/sentuh", pemain: "2–4 tim · balapan", tips: "Tombol JAWAB! diperebutkan — atur siapa menekan dari tiap tim agar adil." },
  "famili-100": { ratio: "ratio-16-10", focus: "", keyboard: "Ketik + Enter", pemain: "2 tim · tebak survei", tips: "Guru mengetik jawaban tim di IFP. Cocok untuk melatih kosakata dan diskusi." },
  "gesture-battle": { ratio: "ratio-16-9", focus: "arena-focus", keyboard: "Kamera / sentuh", pemain: "1–6 pemain · gerak", tips: "Butuh kamera + ruang gerak di depan IFP. Kalibrasi 4 titik dulu sebelum mulai." },
  "kamera-benar-salah": { ratio: "ratio-16-9", focus: "arena-focus", keyboard: "Kamera + klik guru", pemain: "Kelompok · gerak badan", tips: "Siswa berdiri ke zona kiri/kanan. Guru mengunci jawaban dari laptop." },
  "millionaire": { ratio: "ratio-16-10", focus: "", keyboard: "A–D / 1–4, Enter, Spasi", pemain: "Individu / tim / rebutan", tips: "Mode rebutan paling seru di IFP. Lifeline 50:50 dan voting penonton memancing diskusi." },
  "mystery-box": { ratio: "ratio-16-10", focus: "arena-focus", keyboard: "Klik/sentuh, Esc/Spasi", pemain: "2–8 tim · pilih kotak", tips: "Klik kotak dari IFP langsung. Sesuai untuk review materi sebelum ulangan." },
  "snake-quiz": { ratio: "ratio-16-10", focus: "arena-focus", keyboard: "WASD vs Panah, 1–4, P/Spasi", pemain: "2 tim · arkade", tips: "Dua pengendali (keyboard + D-pad sentuh IFP). Cocok sebagai penutup pelajaran yang energik." },
  "xxo-edukasi": { ratio: "ratio-16-10", focus: "", keyboard: "Klik/sentuh", pemain: "X vs O · rebut kotak", tips: "Rebut kotak lalu jawab soal. 3 berurutan = kombinasi +100." },
};

export default async function MpiPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const user = await requireUser();
  const { game: activeGameSlug } = await searchParams;

  // Game DB (aktif) digabung dengan default statis agar bank soal guru langsung tampil.
  const dbGames = await prisma.mpiGame.findMany({
    where: { aktif: true },
    orderBy: { urutan: "asc" },
    select: { slug: true, nama: true, deskripsi: true, icon: true, filePath: true },
  }).catch(() => []);
  const games = dbGames.length > 0
    ? dbGames.map((g) => ({
        slug: g.slug,
        title: g.nama,
        desc: g.deskripsi ?? "",
        icon: g.icon,
        file: g.filePath || `${g.slug}.html`,
      }))
    : DEFAULT_GAMES;

  const activeGame = games.find((g) => g.slug === activeGameSlug);
  // Tingkat siswa untuk filter soal (7/8/9); non-siswa = semua tingkat.
  const me = user.role === "SISWA"
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { classRef: { select: { tingkat: true } } },
      }).catch(() => null)
    : null;
  const tingkat = me?.classRef?.tingkat ?? undefined;

  if (activeGame) {
    const stage = STAGE[activeGame.slug] ?? { ratio: "ratio-16-10", focus: "" as const, keyboard: "Klik/sentuh", pemain: "Kelas", tips: "" };
    const isGuru = user.role === "GURU" || user.role === "ADMIN";
    return (
      <AppShell user={user} active="/mpi">
        <div className="breadcrumb">
          <a href="/dashboard">Beranda</a>
          <span className="sep">&gt;</span>
          <a href="/mpi">MPI Edukasi</a>
          <span className="sep">&gt;</span>
          <span className="current">{activeGame.title}</span>
        </div>
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>
              {activeGame.icon} {activeGame.title}
            </h1>
            <p className="muted">{activeGame.desc}</p>
            <p className="muted" style={{ marginTop: 4 }}>
              👥 {stage.pemain} · ⌨️ {stage.keyboard}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-sm" href={`/game/${activeGame.file}`} target="_blank" rel="noreferrer" title="Buka arena layar penuh di tab baru — ideal untuk IFP">
              ⛶ Layar Penuh
            </a>
            <a className="btn btn-sm" href="/mpi">
              ← Arena Game
            </a>
          </div>
        </div>

        {isGuru && stage.tips && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            💡 <b>Panduan IFP:</b> {stage.tips}
          </div>
        )}

        <div className={`mpi-stage ${stage.focus}`}>
          {/* Kolom soal server (koreksi di server, kunci tidak ke klien) */}
          <MpiMain slug={activeGame.slug} title={activeGame.title} tingkat={tingkat} />

          {/* Kolom arena visual: soal guru via shim /api/questions.php */}
          <div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <h2>🎮 Arena Visual</h2>
                <span className="muted">Soal guru · skor kelas</span>
              </div>
              <div className="card-body" style={{ padding: 0, overflow: "hidden" }}>
                <div className={`mpi-arena ${stage.ratio}`}>
                  <iframe
                    src={`/game/${activeGame.file}`}
                    title={activeGame.title}
                    allow="camera; microphone; fullscreen; autoplay"
                  />
                </div>
              </div>
            </div>
            <div className="mpi-arena-tools">
              <a className="btn btn-sm btn-block-mobile" href={`/game/${activeGame.file}`} target="_blank" rel="noreferrer">
                ⛶ Buka Arena Layar Penuh (untuk IFP)
              </a>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} active="/mpi">
      <div className="breadcrumb">
        <a href="/dashboard">Beranda</a>
        <span className="sep">&gt;</span>
        <span className="current">MPI Edukasi</span>
      </div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>MPI Edukasi</h1>
          <p>Game edukasi interaktif berbasis web untuk pembelajaran aktif di kelas dan mandiri.</p>
        </div>
        {(user.role === "GURU" || user.role === "ADMIN") && (
          <a className="btn btn-sm btn-primary btn-block-mobile" href="/mpi/bank" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            📚 Kelola Bank Soal
          </a>
        )}
      </div>

      <div className="mpi-grid">
        {games.map((g) => {
          const st = STAGE[g.slug];
          return (
          <div key={g.slug} className="card mpi-card">
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  border: "var(--line)",
                  background: "var(--yellow)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 24,
                  boxShadow: "2px 2px 0 var(--ink)",
                }}>
                  {g.icon}
                </div>
                <span className="badge badge-yellow">GAME INTERAKTIF</span>
              </div>
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>{g.title}</h2>
              <p className="muted" style={{ fontSize: 14 }}>{g.desc}</p>
              {st && (
                <p className="meta" style={{ marginTop: 6 }}>
                  👥 {st.pemain} · ⌨️ {st.keyboard}
                </p>
              )}
            </div>
            <div style={{ padding: "0 16px 16px" }}>
              <a className="btn btn-primary" style={{ width: "100%", textAlign: "center" }} href={`/mpi?game=${g.slug}`}>
                Mainkan Game →
              </a>
            </div>
          </div>
          );
        })}
      </div>
    </AppShell>
  );
}
