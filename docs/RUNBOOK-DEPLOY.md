# RUNBOOK-DEPLOY — Portal Panglima (panglima.smp5tegal.sch.id)

> Untuk operator server. Pola: **developer push ke GitHub → server tinggal `git pull`**. Tidak ada build di server.
> Menggantikan RUNBOOK lama (lms.*) untuk deployment portal. Server lama (lms/presensi/mpi/ujian)
> tetap hidup paralel sampai cutover awal semester — PRD v2 §7.

## 0. Prinsip & batas

- **Laptop = Windows, server = Ubuntu.** Skrip `bash scripts/deploy.sh` dijalankan dari **Git Bash**.
- Engine Prisma Linux dibundel di branch `deploy` (`binaryTargets native + debian-openssl-3.0.x`) — server TIDAK build.
- Semua file dipaksa **LF** via `.gitattributes` ⇒ skrip server langsung jalan tanpa `dos2unix`.
- Port internal **3005**. nginx satu di port 80, dipilah `server_name`.
- HTTPS diurus Cloudflare Tunnel; origin cukup listen 80.
- DB: MariaDB existing, **`panglima`**, user **`panglima_user`** (grant hanya `panglima.*` + SELECT `cbt_tka.exams/classes`).
- Data **fresh** (PRD v2 D4): TIDAK ada bootstrap/migrasi data lama. Seed = roster resmi sekolah (§5).
- Jangan restart `cloudflared`/`nginx`/`panglima` saat jam ujian CBT berlangsung.

## 1. Setup awal server (sekali)

```bash
# di SERVER Ubuntu sebagai root:
sudo bash deploy/setup-server.sh
# membuat: Node ≥22 (tarball), swap 2G, user deploy, clone branch deploy
# ke /var/www/panglima, DB+user, /var/www/panglima/.env, migrate baseline,
# systemd panglima, nginx vhost, cek /healthz.

# buat admin pertama:
cd /var/www/panglima && sudo -u deploy node --env-file=.env scripts-server/reset-admin.mjs
# → username: admin   password: Admin#5Tegal2026  (GANTI setelah login!)
```

## 2. Database & .env (dibuat setup-server.sh — verifikasi saja)

```bash
sudo mysql -e "SHOW DATABASES LIKE 'panglima'; SHOW GRANTS FOR 'panglima_user'@'localhost';"
sudo cat /var/www/panglima/.env   # root-only; pastikan CBT_SSO_ENABLED=0 (default aman)
```

`.env` wajib berisi: `DATABASE_URL` (mysql panglima_user), `PORT=3005`, `HOST=127.0.0.1`,
`NODE_ENV=production`, `AUTH_SECRET`, `API_TOKEN`, `CBT_HANDOFF_SECRET`,
`CBT_BASE_URL=https://ujian.smp5tegal.sch.id`, `CBT_SSO_ENABLED=0`,
`STORAGE_DIR=/var/www/panglima/storage/uploads`, `SCHOOL_*`.

## 3. Tunnel Cloudflare + DNS (sekali)

```bash
# nginx vhost sudah dipasang setup-server.sh §7. Tambah ingress tunnel:
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak-$(date +%F)
sudo nano /etc/cloudflared/config.yml   # sisipkan blok deploy/cloudflared-ingress-add.yml
sudo cloudflared tunnel ingress validate -f /etc/cloudflared/config.yml
sudo systemctl restart cloudflared      # ← LUAR JAM SEKOLAH/ujian

# DNS (dari laptop yg login cloudflared):
cloudflared tunnel route dns <NAMA-TUNNEL> panglima.smp5tegal.sch.id
```

Uji: `https://panglima.smp5tegal.sch.id/healthz` → `{"ok":true,"app":"panglima"}`.

## 4. Update rutin (setiap rilis)

```bash
# ── di LAPTOP ──
bash scripts/deploy.sh            # build + push branch deploy

# ── di SERVER ──
cd /var/www/panglima && sudo -u deploy git pull
# bila rilis membawa migrasi baru (lihat pesan commit "deploy artefak …"):
sudo bash -c 'set -a; . /var/www/panglima/.env; set +a; node /opt/panglima-tools/node_modules/prisma/build/index.js migrate deploy'
sudo systemctl restart panglima
systemctl status panglima --no-pager
curl -s http://127.0.0.1:3005/healthz
```

## 5. Seed awal (sekali, data fresh — BUKAN bootstrap lama)

1. Siapkan roster resmi (CSV/Dapodik): NIS/NISN, nama, rombel, NIP guru — divalidasi, bukan fuzzy-match.
2. Buat akun massal via `/admin/import` (template CSV di `/api/templates`), PIN sementara + wajib ganti saat login pertama (`must_change_pin`).
3. Relasi ortu→anak dari formulir sekolah.
4. JANGAN jalankan `seed-demo` di produksi (berisi NISN asli).

## 6. Aktifkan handoff SSO (P7, setelah CBT di-update)

1. Deploy CBT yang sudah punya `GET /sso` + `UserRole::Guru` ke server.
2. Samakan secret: `CBT_HANDOFF_SECRET` (Laravel `.env`) = `CBT_HANDOFF_SECRET` (portal `.env`).
3. Set `CBT_PORTAL_BASE_URL=https://panglima.smp5tegal.sch.id` di `.env` CBT.
4. Di portal: ubah `CBT_SSO_ENABLED=0` → `1`, restart panglima.
5. Uji dengan 1 akun siswa + 1 guru (G2): tombol portal → masuk CBT tanpa ketik ulang; login manual tetap bisa.

## 7. Backup & restore

```bash
# cron /etc/cron.d/panglima-backup — jam 02:30:
30 2 * * * deploy /var/www/panglima/scripts-server/backup-panglima.sh /mnt/backup/panglima
```
Target HARUS perangkat berbeda (PRD v2 §9). Restore:
```bash
gunzip < /mnt/backup/panglima/db-YYYYMMDD.sql.gz | mysql panglima
tar -xzf uploads-YYYYMMDD.tar.gz -C /var/www/panglima/storage/
```
**Drill restore tiap awal semester** (gerbang G7).

## 8. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| 502 nginx | panglima.service mati | `journalctl -u panglima` — cek .env/DATABASE_URL/port 3005 |
| 523/521 | tunnel mati / ingress salah indentasi | restore `config.yml.bak`, restart cloudflared luar jam |
| `CBT_BASE_URL belum diset` | .env tidak terbaca | cek `WorkingDirectory` + `--env-file=.env` di service |
| Tombol ujian 404 `/sso` | CBT lama + SSO=1 | kembalikan `CBT_SSO_ENABLED=0` + restart |
| Login gagal semua | jam server / hash | cek TZ Asia/Jakarta, `SELECT 1` ke MariaDB |

## 9. Rollback rilis

```bash
cd /var/www/panglima
git log --oneline -5
git checkout <commit-lama>
sudo systemctl restart panglima
# migrasi TIDAK mundur otomatis — skema backward-compatible
# (tambah kolom, jangan hapus/ubah semantik).
```
