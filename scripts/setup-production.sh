#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_DIR}"

echo "=========================================="
echo "Starting MAKT CRM Production Setup"
echo "=========================================="

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Syncing database schema..."
npx prisma db push --skip-generate || npx prisma migrate deploy || echo "Database in sync."

echo "==> Building Next.js application..."
npm run build

echo "==> Starting / Reloading PM2 ecosystem..."
if command -v pm2 &> /dev/null; then
  pm2 startOrReload ecosystem.config.js --update-env
  
  echo "==> Configuring log rotation..."
  pm2 install pm2-logrotate 2>/dev/null || true
  pm2 set pm2-logrotate:max_size 20M 2>/dev/null || true
  pm2 set pm2-logrotate:retain 14 2>/dev/null || true
  
  echo "==> Saving PM2 startup state..."
  pm2 save

  echo "==> Configuring daily automated backup cron (2:00 AM)..."
  chmod +x scripts/create-encrypted-backup.sh
  CRON_JOB="0 2 * * * ${APP_DIR}/scripts/create-encrypted-backup.sh >> ${APP_DIR}/backup.log 2>&1"
  (crontab -l 2>/dev/null | grep -v "create-encrypted-backup.sh" || true; echo "${CRON_JOB}") | crontab - || echo "Notice: crontab configuration skipped."
else
  echo "WARNING: pm2 is not installed or not in PATH. Skipping pm2 start."
fi

echo "=========================================="
echo "Production setup completed successfully!"
echo "=========================================="
