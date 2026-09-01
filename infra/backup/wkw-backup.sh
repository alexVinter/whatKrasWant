#!/usr/bin/env bash

set -Eeuo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

BASE="/var/backups/whatKrasWant"
PG_DIR="$BASE/postgres"
MINIO_DIR="$BASE/minio"

STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"

PG_FILE="$PG_DIR/wkw_${STAMP}.dump"
MINIO_SNAPSHOT="$MINIO_DIR/$STAMP"

echo "=================================================="
echo "WKW backup started: $(date)"
echo "=================================================="

mkdir -p "$PG_DIR" "$MINIO_SNAPSHOT"

# --------------------------------------------------
# PostgreSQL
# --------------------------------------------------

echo "[1/4] PostgreSQL backup..."

docker exec wkw-postgres sh -lc \
'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
> "$PG_FILE"

if [ ! -s "$PG_FILE" ]; then
    echo "ERROR: PostgreSQL backup is empty"
    exit 1
fi

docker run --rm \
    -v "$PG_DIR:/backup:ro" \
    postgres:15-alpine \
    pg_restore -l "/backup/$(basename "$PG_FILE")" \
    >/dev/null

echo "PostgreSQL OK: $PG_FILE"
du -h "$PG_FILE"

# --------------------------------------------------
# MinIO
# --------------------------------------------------

echo "[2/4] MinIO backup..."

MINIO_USER="$(
    docker inspect wkw-minio \
    --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | sed -n 's/^MINIO_ROOT_USER=//p' \
    | head -n1
)"

MINIO_PASS="$(
    docker inspect wkw-minio \
    --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | sed -n 's/^MINIO_ROOT_PASSWORD=//p' \
    | head -n1
)"

NETWORK="$(
    docker inspect wkw-minio \
    --format '{{range $name, $config := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
    | head -n1
)"

if [ -z "$MINIO_USER" ] || [ -z "$MINIO_PASS" ]; then
    echo "ERROR: MinIO credentials not found"
    exit 1
fi

if [ -z "$NETWORK" ]; then
    echo "ERROR: Docker network not found"
    exit 1
fi

docker run --rm \
    --network "$NETWORK" \
    -e MINIO_USER="$MINIO_USER" \
    -e MINIO_PASS="$MINIO_PASS" \
    -e STAMP="$STAMP" \
    -v "$MINIO_DIR:/backup" \
    --entrypoint /bin/sh \
    minio/mc:latest \
    -c '
set -eu

mc alias set wkw http://minio:9000 "$MINIO_USER" "$MINIO_PASS" >/dev/null

FOUND=0

mc ls wkw | while IFS= read -r line; do
    bucket="${line##* }"
    bucket="${bucket%/}"

    [ -n "$bucket" ] || continue

    echo "Backing up MinIO bucket: $bucket"

    mkdir -p "/backup/$STAMP/$bucket"

    mc mirror --preserve \
        "wkw/$bucket" \
        "/backup/$STAMP/$bucket"

    FOUND=1
done
'

echo "MinIO OK: $MINIO_SNAPSHOT"
du -sh "$MINIO_SNAPSHOT" || true

# --------------------------------------------------
# Retention
# --------------------------------------------------

echo "[3/4] Removing backups older than 14 days..."

find "$PG_DIR" \
    -type f \
    -name 'wkw_*.dump' \
    -mtime +14 \
    -delete

find "$MINIO_DIR" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -mtime +14 \
    -exec rm -rf {} +

# --------------------------------------------------
# Summary
# --------------------------------------------------

echo "[4/4] Backup completed."

echo
echo "PostgreSQL:"
ls -lh "$PG_FILE"

echo
echo "MinIO:"
du -sh "$MINIO_SNAPSHOT" || true

echo
echo "Disk:"
df -h "$BASE"

echo
echo "WKW backup finished: $(date)"
