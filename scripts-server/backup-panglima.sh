#!/usr/bin/env bash
# Backup PANGLIMA: dump DB + upload files → direktori backup, retensi 30 hari.
# Dipanggil dari cron 02:30 (lihat docs/RUNBOOK-DEPLOY.md §7). args: <BACKUP_DIR>
# Target HARUS perangkat berbeda (PRD v2 §9) — bukan partisi disk yang sama.
set -euo pipefail
DEST="${1:?pakai: backup-panglima.sh /path/ke/disk-backup}"
APP=/var/www/panglima
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

# kredensial db dari DATABASE_URL di .env
DB_URL=$(grep -m1 '^DATABASE_URL' "$APP/.env" | cut -d'"' -f2)
# mysql://user:pass@host:port/db
DB_USER=$(echo "$DB_URL" | sed -E 's#mysql://([^:]+):([^@]*)@.*#\1#')
DB_PASS=$(echo "$DB_URL" | sed -E 's#mysql://([^:]+):([^@]*)@.*#\2#')
DB_NAME=$(echo "$DB_URL" | sed -E 's#.*/([^/?]+).*#\1#')

umask 077
MYSQL_PWD="$DB_PASS" mysqldump --single-transaction --routines "$DB_NAME" \
  | gzip > "$DEST/db-$STAMP.sql.gz"

tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP" storage 2>/dev/null || {
  mkdir -p "$APP/storage/uploads"; tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP" storage;
}

# retensi 30 hari
find "$DEST" -name 'db-*.sql.gz' -mtime +30 -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +30 -delete

echo "$(date -Is) backup ok → $DEST/db-$STAMP.sql.gz"
