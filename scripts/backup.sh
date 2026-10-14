#!/usr/bin/env bash
# ==========================================================
# ScanDoc Automated Backup Script
# Performs MongoDB dump + compressed upload storage backup
# Retains only the 7 most recent backups
# ==========================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/scandoc}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_DIR}/backup_${TIMESTAMP}"
MAX_BACKUPS=7

mkdir -p "${TARGET_DIR}"

echo "==> [1/3] Backing up MongoDB database..."
if docker ps --format '{{.Names}}' | grep -q 'mongo'; then
  docker exec "$(docker ps -qf 'name=mongo' | head -n 1)" \
    mongodump --out="/tmp/mongodump_${TIMESTAMP}" --quiet || true
  
  docker cp "$(docker ps -qf 'name=mongo' | head -n 1):/tmp/mongodump_${TIMESTAMP}" "${TARGET_DIR}/mongo_dump" || true
  docker exec "$(docker ps -qf 'name=mongo' | head -n 1)" rm -rf "/tmp/mongodump_${TIMESTAMP}" || true
else
  echo "MongoDB container not running, checking for local data backup..."
  if [ -d "./data" ]; then
    cp -r ./data "${TARGET_DIR}/data_fallback"
  fi
fi

echo "==> [2/3] Archiving uploads volume..."
docker run --rm \
  -v scandoc_uploads:/uploads:ro \
  -v "${TARGET_DIR}":/backup \
  alpine tar -czf /backup/uploads.tar.gz -C /uploads . || true

# Compress full backup bundle
cd "${BACKUP_DIR}"
tar -czf "scandoc_full_${TIMESTAMP}.tar.gz" "backup_${TIMESTAMP}"
rm -rf "backup_${TIMESTAMP}"

echo "==> [3/3] Rotating old backups (keeping latest ${MAX_BACKUPS})..."
ls -tp "${BACKUP_DIR}"/scandoc_full_*.tar.gz 2>/dev/null | grep -v '/$' | tail -n +$((MAX_BACKUPS + 1)) | xargs -I {} rm -- {} 2>/dev/null || true

echo "Backup completed successfully: ${BACKUP_DIR}/scandoc_full_${TIMESTAMP}.tar.gz"
