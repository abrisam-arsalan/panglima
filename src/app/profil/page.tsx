import Link from "next/link";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/app-shell";
import PageHead from "@/components/page-head";
import { updateProfileName, updateProfilePassword } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin / TU",
  GURU: "Guru",
  SISWA: "Siswa",
  ORTU: "Orang tua",
  KEPSEK: "Kepala sekolah",
};

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requireUser();
  const { err, msg } = await searchParams;
  const isSiswa = user.role === "SISWA";

  return (
    <AppShell user={user} active="/profil">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">BERANDA</Link>
        <span className="sep">&gt;</span>
        <span className="current">PROFIL SAYA</span>
      </nav>

      <PageHead
        title="Profil Saya"
        sub="Kelola nama tampilan dan password akun Anda."
      />

      {msg && <div className="alert alert-success">✓ {decodeURIComponent(msg)}</div>}
      {err && <div className="alert alert-error">✕ {decodeURIComponent(err)}</div>}

      <div className="form-grid two">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head"><h2>Data Akun</h2></div>
          <div className="card-body">
            <div className="list-row" style={{ marginBottom: 8 }}>
              <div className="meta">NAMA TAMPIL</div>
              <b>{user.nama}</b>
            </div>
            <div className="list-row" style={{ marginBottom: 8 }}>
              <div className="meta">USERNAME LOGIN</div>
              <code>{user.username}</code>
              <div className="meta" style={{ marginTop: 4 }}>NISN / NIP / username — tidak dapat diubah sendiri, hubungi admin.</div>
            </div>
            <div className="list-row">
              <div className="meta">PERAN</div>
              <span className="pill">{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>

            <form action={updateProfileName} style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div>
                <label className="field-label" htmlFor="nama">Ubah Nama Tampil</label>
                <input
                  id="nama"
                  className="input"
                  name="nama"
                  defaultValue={user.nama}
                  required
                  minLength={3}
                  maxLength={120}
                  style={{ minHeight: 44 }}
                />
              </div>
              <button className="btn btn-primary btn-block-mobile" type="submit" style={{ minHeight: 44 }}>
                Simpan Nama
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="card-head"><h2>Ganti {isSiswa ? "PIN" : "Password"}</h2></div>
          <div className="card-body">
            <form action={updateProfilePassword} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="field-label" htmlFor="oldPassword">{isSiswa ? "PIN Lama" : "Password Lama"}</label>
                <input
                  id="oldPassword"
                  className="input"
                  type="password"
                  name="oldPassword"
                  autoComplete="current-password"
                  required
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="newPassword">{isSiswa ? "PIN Baru (6 digit angka)" : "Password Baru (min. 6 karakter)"}</label>
                <input
                  id="newPassword"
                  className="input"
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  {...(isSiswa
                    ? { inputMode: "numeric" as const, pattern: "[0-9]{6}", maxLength: 6 }
                    : { minLength: 6, maxLength: 72 })}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="confirmPassword">Ulangi {isSiswa ? "PIN" : "Password"} Baru</label>
                <input
                  id="confirmPassword"
                  className="input"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  style={{ minHeight: 44 }}
                />
              </div>
              <button className="btn btn-green btn-block-mobile" type="submit" style={{ minHeight: 44 }}>
                Ganti {isSiswa ? "PIN" : "Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
