#!/bin/sh
# نسخة احتياطية من PostgreSQL كل يوم (صيغة pg_dump المضغوطة) في ./backups، وحذف الأقدم.
# الاسترجاع: انظر README (pg_restore).
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

until pg_isready -q; do sleep 2; done
while true; do
  file="/backups/dealzora-sync-$(date -u +%Y%m%d-%H%M%S).dump"
  if pg_dump --no-owner --format=custom --file="$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "backup ok: $file"
  else
    rm -f "$file.tmp"
    echo "backup FAILED" >&2
  fi
  find /backups -name 'dealzora-sync-*.dump' -mtime +"$KEEP_DAYS" -delete
  sleep "$INTERVAL"
done
