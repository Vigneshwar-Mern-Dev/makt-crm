#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_DIR}"

BACKUP_DIR="${HOME}/crm-backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TMP_DIR="$(mktemp -d /tmp/crm-backup-XXXXXX)"

mkdir -p "${BACKUP_DIR}"

echo "=========================================="
echo "Creating MAKT CRM Encrypted Backup"
echo "=========================================="

# Source .env if exists to get DATABASE_URL
if [ -f .env ]; then
  # export non-comment lines
  set -a
  source <(grep -v '^#' .env | grep -v '^$') || true
  set +a
  cp .env "${TMP_DIR}/.env"
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "==> Exporting PostgreSQL database..."
  if command -v pg_dump &> /dev/null; then
    pg_dump "${DATABASE_URL}" --format=custom --file="${TMP_DIR}/database.dump" || echo "pg_dump encountered an issue, check DATABASE_URL."
  else
    echo "NOTICE: pg_dump not installed. Skipping database dump in local backup."
  fi
fi

[ -f ecosystem.config.js ] && cp ecosystem.config.js "${TMP_DIR}/ecosystem.config.js"

if [ -d ".wwebjs_auth" ]; then
  echo "==> Backing up WhatsApp session data..."
  cp -r .wwebjs_auth "${TMP_DIR}/.wwebjs_auth"
fi

ARCHIVE_TAR="${BACKUP_DIR}/crm-backup-${TIMESTAMP}.tar.gz"
ENC_TAR="${ARCHIVE_TAR}.enc"

tar -czf "${ARCHIVE_TAR}" -C "${TMP_DIR}" .
rm -rf "${TMP_DIR}"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  echo "==> Encrypting archive with AES-256-CBC..."
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -in "${ARCHIVE_TAR}" -out "${ENC_TAR}" -pass env:BACKUP_PASSPHRASE
  rm -f "${ARCHIVE_TAR}"
  echo "==> Encrypted backup saved to: ${ENC_TAR}"
else
  echo "==> Plain backup saved to: ${ARCHIVE_TAR}"
  echo "NOTE: Set BACKUP_PASSPHRASE environment variable for encryption."
fi

echo "=========================================="
echo "Backup complete!"
echo "=========================================="
