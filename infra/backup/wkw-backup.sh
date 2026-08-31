#!/usr/bin/env bash
# Automated backup for «Чего хочет Красноярск?» (PostgreSQL + MinIO).
# Production paths and container names — see docs/BACKUP_RESTORE.md

set -Eeuo pipefail

readonly POSTGRES_CONTAINER="${WKW_POSTGRES_CONTAINER:-wkw-postgres}"
readonly MINIO_CONTAINER="${WKW_MINIO_CONTAINER:-wkw-minio}"
readonly BACKUP_ROOT="${WKW_BACKUP_ROOT:-/var/backups/whatKrasWant}"
readonly POSTGRES_BACKUP_DIR="${BACKUP_ROOT}/postgres"
readonly MINIO_BACKUP_DIR="${BACKUP_ROOT}/minio"
readonly RETENTION_DAYS="${WKW_BACKUP_RETENTION_DAYS:-14}"
readonly MC_IMAGE="${WKW_MC_IMAGE:-minio/mc:latest}"
readonly MINIO_ENDPOINT="${WKW_MINIO_ENDPOINT:-http://minio:9000}"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

container_env_value() {
  local container="$1"
  local key="$2"

  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
    | sed -n "s/^${key}=//p" \
    | head -n 1
}

container_network() {
  local container="$1"

  docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{break}}{{end}}' "$container"
}

ensure_container_running() {
  local container="$1"
  local state

  state="$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)"
  if [[ "$state" != "true" ]]; then
    fail "Container is not running: ${container}"
  fi
}

human_size() {
  local path="$1"
  du -sh "$path" 2>/dev/null | cut -f1
}

backup_postgres() {
  log "=== PostgreSQL backup: start ==="

  ensure_container_running "$POSTGRES_CONTAINER"

  local postgres_user postgres_db timestamp dump_name dump_path tmp_dump
  postgres_user="$(container_env_value "$POSTGRES_CONTAINER" "POSTGRES_USER")"
  postgres_db="$(container_env_value "$POSTGRES_CONTAINER" "POSTGRES_DB")"

  [[ -n "$postgres_user" ]] || fail "POSTGRES_USER not found in ${POSTGRES_CONTAINER}"
  [[ -n "$postgres_db" ]] || fail "POSTGRES_DB not found in ${POSTGRES_CONTAINER}"

  timestamp="$(date -u +%Y-%m-%d_%H-%M-%S)"
  dump_name="wkw_${timestamp}.dump"
  dump_path="${POSTGRES_BACKUP_DIR}/${dump_name}"
  tmp_dump="/tmp/${dump_name}"

  mkdir -p "$POSTGRES_BACKUP_DIR"

  log "Creating dump: ${dump_path}"
  docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$postgres_user" -d "$postgres_db" -Fc -f "$tmp_dump"

  docker cp "${POSTGRES_CONTAINER}:${tmp_dump}" "$dump_path"
  docker exec "$POSTGRES_CONTAINER" rm -f "$tmp_dump"

  if [[ ! -s "$dump_path" ]]; then
    fail "PostgreSQL dump is empty: ${dump_path}"
  fi

  log "Verifying dump with pg_restore -l"
  docker cp "$dump_path" "${POSTGRES_CONTAINER}:${tmp_dump}"
  docker exec "$POSTGRES_CONTAINER" pg_restore -l "$tmp_dump" >/dev/null
  docker exec "$POSTGRES_CONTAINER" rm -f "$tmp_dump"

  log "PostgreSQL backup OK: ${dump_path} ($(human_size "$dump_path"))"
}

backup_minio() {
  log "=== MinIO backup: start ==="

  ensure_container_running "$MINIO_CONTAINER"

  local minio_user minio_pass network timestamp dest_base buckets_raw bucket
  minio_user="$(container_env_value "$MINIO_CONTAINER" "MINIO_ROOT_USER")"
  minio_pass="$(container_env_value "$MINIO_CONTAINER" "MINIO_ROOT_PASSWORD")"
  network="$(container_network "$MINIO_CONTAINER")"

  [[ -n "$minio_user" ]] || fail "MINIO_ROOT_USER not found in ${MINIO_CONTAINER}"
  [[ -n "$minio_pass" ]] || fail "MINIO_ROOT_PASSWORD not found in ${MINIO_CONTAINER}"
  [[ -n "$network" ]] || fail "Docker network not found for ${MINIO_CONTAINER}"

  timestamp="$(date -u +%Y-%m-%d_%H-%M-%S)"
  dest_base="${MINIO_BACKUP_DIR}/${timestamp}"
  mkdir -p "$dest_base"

  log "Listing MinIO buckets via temporary mc container (network: ${network})"
  buckets_raw="$(
    docker run --rm \
      --network "$network" \
      -e "MINIO_ROOT_USER=${minio_user}" \
      -e "MINIO_ROOT_PASSWORD=${minio_pass}" \
      -e "MINIO_ENDPOINT=${MINIO_ENDPOINT}" \
      "$MC_IMAGE" \
      sh -c 'mc alias set src "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc ls src'
  )"

  if [[ -z "${buckets_raw//[$' \t\r\n']/}" ]]; then
    log "WARNING: No MinIO buckets found"
    return 0
  fi

  local bucket_count=0
  while IFS= read -r line; do
    [[ -n "${line//[$' \t\r\n']/}" ]] || continue

    bucket="${line##* }"
    bucket="${bucket%/}"

    [[ -n "$bucket" ]] || continue
    [[ "$bucket" == *"/"* ]] && continue

    bucket_count=$((bucket_count + 1))
    log "Mirroring bucket: ${bucket} -> ${dest_base}/${bucket}/"

    docker run --rm \
      --network "$network" \
      -v "${dest_base}:/backup" \
      -e "MINIO_ROOT_USER=${minio_user}" \
      -e "MINIO_ROOT_PASSWORD=${minio_pass}" \
      -e "MINIO_ENDPOINT=${MINIO_ENDPOINT}" \
      -e "MINIO_BUCKET=${bucket}" \
      "$MC_IMAGE" \
      sh -c 'mc alias set src "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc mirror --preserve "src/${MINIO_BUCKET}" "/backup/${MINIO_BUCKET}"'

    log "Bucket ${bucket} OK ($(human_size "${dest_base}/${bucket}"))"
  done <<EOF
$buckets_raw
EOF

  if [[ "$bucket_count" -eq 0 ]]; then
    log "WARNING: mc ls returned output, but no buckets were parsed"
  else
    log "MinIO backup OK: ${dest_base} ($(human_size "$dest_base"), ${bucket_count} bucket(s))"
  fi
}

apply_retention() {
  log "=== Retention: removing backups older than ${RETENTION_DAYS} days ==="

  if [[ -d "$POSTGRES_BACKUP_DIR" ]]; then
    find "$POSTGRES_BACKUP_DIR" -type f -name 'wkw_*.dump' -mtime +"$RETENTION_DAYS" -print -delete || true
  fi

  if [[ -d "$MINIO_BACKUP_DIR" ]]; then
    find "$MINIO_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} + || true
  fi

  log "Retention complete"
}

print_summary() {
  log "=== Backup summary ==="
  log "PostgreSQL directory: ${POSTGRES_BACKUP_DIR} ($(human_size "$POSTGRES_BACKUP_DIR"))"
  log "MinIO directory: ${MINIO_BACKUP_DIR} ($(human_size "$MINIO_BACKUP_DIR"))"
  log "Filesystem usage:"
  df -h "$BACKUP_ROOT" || df -h /
}

main() {
  require_command docker
  require_command find
  require_command du
  require_command df
  require_command sed
  require_command date

  mkdir -p "$POSTGRES_BACKUP_DIR" "$MINIO_BACKUP_DIR"

  log "Backup started (root: ${BACKUP_ROOT})"
  backup_postgres
  backup_minio
  apply_retention
  print_summary
  log "Backup finished successfully"
}

main "$@"
