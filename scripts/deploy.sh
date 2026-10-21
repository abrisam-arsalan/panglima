#!/usr/bin/env bash
# ── DEPLOY PANGLIMA: build di LAPTOP → commit artefak ke branch `deploy` → push ──
# Aturan sekolah: hasil push ke GitHub, server tinggal `git pull` (TANPA CI).
# Jalankan dari git-bash di folder repo panglima (laptop developer Windows/WSL/Linux).
#
# Server afterwards:
#   cd /var/www/panglima && sudo -u deploy git pull && sudo systemctl restart panglima
# (bila ada migrasi baru: prisma migrate deploy via /opt/panglima-tools — RUNBOOK-DEPLOY §4)
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=$(git rev-parse --short HEAD)
STAMP=$(date +%Y%m%d-%H%M%S)

echo "▶ 1/5 install & build (binaryTargets linux ikut ter-generate via postinstall)"
# SKIP_INSTALL=1 lewati npm ci (node_modules masih sehat) — hemat ~2-3 menit
[ "${SKIP_INSTALL:-0}" = "1" ] || npm ci --no-audit --no-fund
[ "${SKIP_BUILD:-0}" = "1" ] || npm run build

# Next standalone bisa menaruh output di root ATAU di subfolder nama proyek
if [ -f .next/standalone/server.js ]; then SA=.next/standalone; else SA=.next/standalone/panglima; fi
[ -f "$SA/server.js" ] || { echo "!! server.js tidak ditemukan di standalone"; exit 1; }
echo "▶ standalone root: $SA"

WT=../.panglima-deploy-wt
echo "▶ 2/5 menyiapkan worktree branch deploy di $WT"
git worktree remove --force "$WT" 2>/dev/null || true
git worktree prune
git show-ref --verify --quiet refs/heads/deploy || git branch deploy HEAD
git worktree add --force "$WT" deploy
git -C "$WT" reset --hard HEAD
git -C "$WT" config core.autocrlf false

echo "▶ 3/5 menyalin artefak"
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$SA"/. "$WT"/
mkdir -p "$WT/.next"
cp -r .next/static "$WT/.next/static"
[ -d public ] && cp -r public "$WT/public" || true
cp -r prisma "$WT/prisma"
mkdir -p "$WT/src/generated" "$WT/scripts-server" "$WT/deploy"
cp -r src/generated/cbt-client "$WT/src/generated/cbt-client"
cp scripts-server/backup-panglima.sh "$WT/scripts-server/backup-panglima.sh"
cp scripts-server/reset-admin.mjs "$WT/scripts-server/reset-admin.mjs"
cp deploy/panglima.service deploy/nginx-panglima.conf deploy/db.sql "$WT/deploy/" 2>/dev/null || true
cp deploy/setup-server.sh "$WT/deploy/" 2>/dev/null || true
chmod +x "$WT"/deploy/*.sh "$WT"/scripts-server/*.sh 2>/dev/null || true
cp .env.example "$WT/.env.example"
[ -f docs/RUNBOOK-DEPLOY.md ] && { mkdir -p "$WT/docs"; cp docs/RUNBOOK-DEPLOY.md "$WT/docs/"; } || true

# engine Prisma utk Linux HARUS ikut (runtime server = debian)
if ! find "$WT/node_modules" -name 'libquery_engine-debian-openssl-3.0.x.so.node' -print -quit | grep -q .; then
  echo "!! Engine debian tidak ada di standalone — jalankan 'npx prisma generate' lalu ulangi"
  exit 1
fi

# .gitattributes: cegah git merapikan byte file engine (.so/.node)
echo '* -text' > "$WT/.gitattributes"

echo "▶ 4/5 commit"
git -C "$WT" add -A
git -C "$WT" commit -q -m "deploy artefak $STAMP (main@$SRC)"

echo "▶ 5/5 push branch deploy"
git -C "$WT" push origin deploy
git worktree remove --force "$WT"

cat <<EOF
✔ Selesai — artefak ter-push ke branch 'deploy'.

DI SERVER (operator):
  cd /var/www/panglima && sudo -u deploy git pull
  # bila muncul migrasi baru: prisma migrate deploy via /opt/panglima-tools (RUNBOOK-DEPLOY §4)
  sudo systemctl restart panglima
EOF
