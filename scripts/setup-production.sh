#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_DIR}"

echo "=========================================="
echo "Starting MAKT CRM Production Setup"
echo "=========================================="

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Applying pending database migrations..."
npx prisma migrate deploy || echo "No new migrations to deploy."

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
else
  echo "WARNING: pm2 is not installed or not in PATH. Skipping pm2 start."
fi

echo "=========================================="
echo "Production setup completed successfully!"
echo "=========================================="
