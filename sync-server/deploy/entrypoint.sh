#!/bin/sh
# تحديث قاعدة البيانات لآخر نسخة ثم تشغيل السيرفر.
set -e
alembic upgrade head
exec uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 \
  --workers "${SYNC_WORKERS:-2}" \
  --proxy-headers --forwarded-allow-ips='*'
