#!/usr/bin/env bash
# ── SETUP AWAL SERVER UBUNTU utk PORTAL PANGLIMA — sekali jalan, idempoten ──
#   sudo bash deploy/setup-server.sh
#   (atau: sudo bash -c "$(curl -fsSL <URL-RAW>/panglima/deploy/setup-server.sh)")
#
# Node dipasang dari TARBALL resmi nodejs.org ke /usr/local (bukan apt):
# kebal terhadap repo/PPA lain yang rusak di server.
# Melakukan: Node ≥22 → user deploy → clone artefak → DB+user MariaDB →
# .env → prisma migrate → systemd → nginx → cek /healthz.
# TIDAK termasuk: cloudflared ingress + DNS (manual, lihat RUNBOOK-DEPLOY §6)
# dan SEED data (PRD v2 D4: data fresh dari roster resmi, bukan bootstrap lama).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/abrisam-arsalan/panglima.git}"
APP=/var/www/panglima
KRED=/root/panglima-kredensial.txt
NEED_MAJOR=22
[ "$(id -u)" = 0 ] || { echo "jalankan dengan sudo"; exit 1; }

echo "▶ 1/8 Node.js — tarball resmi bila kurang"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NEED_MAJOR" ]; then
  case $(uname -m) in x86_64) ARCH=x64;; aarch64) ARCH=arm64;; *) ARCH=x64;; esac
  FILE=$(curl -fsSL "https://nodejs.org/dist/latest-v${NEED_MAJOR}.x/" | grep -oE "node-v[0-9.]+-linux-${ARCH}\.tar\.xz" | head -1)
  [ -n "$FILE" ] || { echo "gagal deteksi berkas Node ${NEED_MAJOR}.x linux-${ARCH}"; exit 1; }
  curl -fsSL -o /tmp/$FILE "https://nodejs.org/dist/latest-v${NEED_MAJOR}.x/$FILE"
  EXPECT=$(curl -fsSL "https://nodejs.org/dist/latest-v${NEED_MAJOR}.x/SHASUMS256.txt" | grep " $FILE\$" | cut -d' ' -f1)
  echo "$EXPECT  /tmp/$FILE" | sha256sum -c -
  mkdir -p /usr/local/lib/nodejs
  tar -xJf /tmp/$FILE -C /usr/local/lib/nodejs
  BASE="${FILE%.tar.xz}"
  ln -sfn "/usr/local/lib/nodejs/$BASE/bin/node" /usr/local/bin/node
  ln -sfn "/usr/local/lib/nodejs/$BASE/bin/npm"  /usr/local/bin/npm
  ln -sfn "/usr/local/lib/nodejs/$BASE/bin/npx"  /usr/local/bin/npx
  rm -f /tmp/$FILE
  hash -r 2>/dev/null || true
fi
NODE_BIN=$(command -v node)
echo "   node: $($NODE_BIN --version) di $NODE_BIN"

echo "▶ 2/8 Swap 2 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | sed -n '1,3p'

echo "▶ 3/8 User & kode (branch artefak 'deploy')"
id -u deploy &>/dev/null || useradd -r -m -d /var/www -s /usr/sbin/nologin deploy
if [ -d "$APP/.git" ]; then
  sudo -u deploy git -C "$APP" fetch origin deploy && sudo -u deploy git -C "$APP" reset --hard origin/deploy
else
  rm -rf "$APP"; git clone -b deploy --depth 1 "$REPO_URL" "$APP"
fi
find "$APP" -name "*.so.node" -exec chmod +x {} +
mkdir -p "$APP/storage/uploads"
chown -R deploy:deploy "$APP"

echo "▶ 4/8 Kredensial & database"
if [ -f "$KRED" ]; then
  # shellcheck disable=SC1090
  . "$KRED"
else
  DB_PASS=$(openssl rand -hex 16)
  AUTH_SECRET=$(openssl rand -hex 32)
  API_TOKEN=$(openssl rand -hex 32)
  CBT_HANDOFF_SECRET=$(openssl rand -hex 32)
  umask 077
  printf 'DB_PASS=%s\nAUTH_SECRET=%s\nAPI_TOKEN=%s\nCBT_HANDOFF_SECRET=%s\n' \
    "$DB_PASS" "$AUTH_SECRET" "$API_TOKEN" "$CBT_HANDOFF_SECRET" > "$KRED"
  echo "   ✔ kredensial ditulis ke $KRED (root-only) — salin ke pengelola password"
  # shellcheck disable=SC1090
  . "$KRED"
fi
mysql <<SQL
CREATE DATABASE IF NOT EXISTS panglima CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'panglima_user'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER 'panglima_user'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON panglima.* TO 'panglima_user'@'localhost';
GRANT SELECT ON cbt_tka.exams TO 'panglima_user'@'localhost';
GRANT SELECT ON cbt_tka.classes TO 'panglima_user'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "▶ 5/8 $APP/.env"
umask 077
cat > "$APP/.env" <<EOF
DATABASE_URL="mysql://panglima_user:$DB_PASS@127.0.0.1:3306/panglima"
PORT=3005
HOST=127.0.0.1
NODE_ENV=production
AUTH_SECRET="$AUTH_SECRET"
API_TOKEN="$API_TOKEN"
CBT_HANDOFF_SECRET="$CBT_HANDOFF_SECRET"
CBT_BASE_URL="https://ujian.smp5tegal.sch.id"
CBT_SSO_ENABLED=0
STORAGE_DIR="/var/www/panglima/storage/uploads"
SCHOOL_NAME="SMP Negeri 5 Tegal"
SCHOOL_ACADEMIC_YEAR="2026/2027"
SCHOOL_SEMESTER_NUMBER=1
EOF
chown deploy:deploy "$APP/.env" && chmod 600 "$APP/.env"

echo "▶ 6/8 Migrate skema (baseline 0_baseline = 33 tabel P1)"
if [ ! -d /opt/panglima-tools/node_modules/prisma ]; then
  npm install --prefix /opt/panglima-tools prisma@6.3.0 --no-audit --no-fund
  chmod -R a+rX /opt/panglima-tools
fi
cd "$APP"
set -a; . "$APP/.env"; set +a
$NODE_BIN /opt/panglima-tools/node_modules/prisma/build/index.js migrate deploy
echo "   Buat akun admin awal:"
echo "   cd $APP && sudo -u deploy node --env-file=.env scripts-server/reset-admin.mjs"

echo "▶ 7/8 systemd + nginx"
sed "s|ExecStart=.*|ExecStart=$NODE_BIN --env-file=.env --max-old-space-size=768 server.js|" \
  "$APP/deploy/panglima.service" > /etc/systemd/system/panglima.service
systemctl daemon-reload && systemctl enable --now panglima && systemctl restart panglima
if [ ! -e /etc/nginx/sites-enabled/panglima.smp5tegal.sch.id ]; then
  cp "$APP/deploy/nginx-panglima.conf" /etc/nginx/sites-available/panglima.smp5tegal.sch.id
  ln -s /etc/nginx/sites-available/panglima.smp5tegal.sch.id /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
fi

echo "▶ 8/8 Cek akhir"
sleep 3
curl -s -o /dev/null -w "  local  :3005/healthz → %{http_code}\n" http://127.0.0.1:3005/healthz
curl -s -H "Host: panglima.smp5tegal.sch.id" -o /dev/null -w "  nginx  :80/healthz    → %{http_code}\n" http://127.0.0.1/healthz
echo
echo "✔ Setup server selesai (tanpa tunnel & tanpa seed)."
echo "  Tunnel ingress (manual): RUNBOOK-DEPLOY §6 — route dns panglima.smp5tegal.sch.id"
echo "  Seed roster resmi     : PRD v2 §8.2 — CSV/Dapodik, BUKAN bootstrap lama"
