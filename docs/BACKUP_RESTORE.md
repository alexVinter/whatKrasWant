# Резервное копирование и восстановление

Документ описывает **production-схему автоматических backup** проекта «Чего хочет Красноярск?».

Скрипты в репозитории: `infra/backup/`.  
На сервере используется установленная копия: `/usr/local/sbin/wkw-backup.sh`.

---

## 1. Что резервируется

| Компонент | Содержимое |
|-----------|------------|
| **PostgreSQL** | Вся база данных приложения (инициативы, пользователи, голоса, новости, настройки и т.д.) |
| **MinIO** | Пользовательские и административные изображения (S3-бuckets) |

На production сейчас используется bucket **`wkw-media`**, но скрипт резервирует **все найденные buckets**.

---

## 2. Где лежат backup на production

```
/var/backups/whatKrasWant/
├── postgres/
│   └── wkw_YYYY-MM-DD_HH-MM-SS.dump
└── minio/
    └── YYYY-MM-DD_HH-MM-SS/
        └── <bucket>/
            └── ...
```

Примеры:

- PostgreSQL: `/var/backups/whatKrasWant/postgres/wkw_2026-08-31_20-30-15.dump`
- MinIO: `/var/backups/whatKrasWant/minio/2026-08-31_20-30-15/wkw-media/...`

---

## 3. Расписание

| Параметр | Значение |
|----------|----------|
| Частота | Каждый день |
| Время (UTC) | **20:30** |
| Время (Красноярск, UTC+7) | **03:30** |
| Cron-файл | `/etc/cron.d/wkw-backup` |
| Блокировка | `flock -n /var/lock/wkw-backup.lock` |
| Лог | `/var/log/wkw-backup.log` |

---

## 4. Retention

- PostgreSQL dumps старше **14 дней** удаляются автоматически.
- MinIO snapshot-директории старше **14 дней** удаляются автоматически.

Минимальный срок хранения: **14 дней**.

---

## 5. Ручной запуск backup

```bash
/usr/local/sbin/wkw-backup.sh
```

---

## 6. Ручной запуск с flock и логированием

(как в cron)

```bash
flock -n /var/lock/wkw-backup.lock /usr/local/sbin/wkw-backup.sh >> /var/log/wkw-backup.log 2>&1
```

---

## 7. Просмотр логов

```bash
tail -100 /var/log/wkw-backup.log
```

---

## 8. Просмотр PostgreSQL backups

```bash
ls -lh /var/backups/whatKrasWant/postgres/
```

Последний dump:

```bash
ls -1t /var/backups/whatKrasWant/postgres/wkw_*.dump | head -1
```

---

## 9. Проверка PostgreSQL dump через pg_restore -l

```bash
DUMP="$(ls -1t /var/backups/whatKrasWant/postgres/wkw_*.dump | head -1)"
docker cp "$DUMP" wkw-postgres:/tmp/verify.dump
docker exec wkw-postgres pg_restore -l /tmp/verify.dump | head -20
docker exec wkw-postgres rm -f /tmp/verify.dump
```

Список объектов должен выводиться без ошибок.

---

## 10. Безопасный тест восстановления PostgreSQL

> **КРИТИЧЕСКИ ВАЖНО:** никогда не восстанавливать dump поверх production-базы `wkw`.  
> Только отдельная временная БД.

```bash
DUMP="$(ls -1t /var/backups/whatKrasWant/postgres/wkw_*.dump | head -1)"
TEST_DB="wkw_restore_test_$(date +%s)"
POSTGRES_USER="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' wkw-postgres | sed -n 's/^POSTGRES_USER=//p' | head -1)"

# 1. Создать временную БД
docker exec wkw-postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${TEST_DB};"

# 2. Скопировать dump в контейнер
docker cp "$DUMP" "wkw-postgres:/tmp/restore-test.dump"

# 3. Восстановить в тестовую БД
docker exec wkw-postgres pg_restore -U "$POSTGRES_USER" -d "$TEST_DB" --no-owner --no-acl /tmp/restore-test.dump

# 4. Проверить таблицы
docker exec wkw-postgres psql -U "$POSTGRES_USER" -d "$TEST_DB" -c '\dt'

# 5. Удалить тестовую БД и временный файл
docker exec wkw-postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE ${TEST_DB};"
docker exec wkw-postgres rm -f /tmp/restore-test.dump
```

---

## 11. MinIO: просмотр и восстановление

### Просмотр последнего snapshot

```bash
SNAPSHOT="$(ls -1dt /var/backups/whatKrasWant/minio/*/ | head -1)"
echo "$SNAPSHOT"
find "$SNAPSHOT" -type f | wc -l
du -sh "$SNAPSHOT"
```

Пример для bucket `wkw-media`:

```bash
du -sh "${SNAPSHOT}wkw-media"
find "${SNAPSHOT}wkw-media" -type f | wc -l
```

### Принцип восстановления

Backup создаётся через `mc mirror --preserve` из MinIO в локальную директорию.  
Обратное восстановление — `mc mirror` из snapshot обратно в bucket.

> Перед восстановлением убедитесь, что понимаете последствия перезаписи данных в bucket.

```bash
SNAPSHOT="$(ls -1dt /var/backups/whatKrasWant/minio/*/ | head -1)"
BUCKET="wkw-media"
NETWORK="$(docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{break}}{{end}}' wkw-minio)"
MINIO_ROOT_USER="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' wkw-minio | sed -n 's/^MINIO_ROOT_USER=//p' | head -1)"
MINIO_ROOT_PASSWORD="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' wkw-minio | sed -n 's/^MINIO_ROOT_PASSWORD=//p' | head -1)"

docker run --rm \
  --network "$NETWORK" \
  -v "${SNAPSHOT}${BUCKET}:/restore:ro" \
  minio/mc:latest \
  sh -c "mc alias set dst http://minio:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' && mc mirror --preserve '/restore' 'dst/${BUCKET}'"
```

---

## 12. Установка backup-системы на новом VPS

```bash
# 1. Директории backup
mkdir -p /var/backups/whatKrasWant/postgres
mkdir -p /var/backups/whatKrasWant/minio

# 2. Скрипт (из checkout репозитория)
cp infra/backup/wkw-backup.sh /usr/local/sbin/wkw-backup.sh
chmod 700 /usr/local/sbin/wkw-backup.sh

# 3. Cron
cp infra/backup/wkw-backup.cron /etc/cron.d/wkw-backup
chmod 644 /etc/cron.d/wkw-backup

# 4. Cron-сервис
systemctl enable --now cron

# 5. Обязательная проверка после установки
/usr/local/sbin/wkw-backup.sh
# затем — безопасный restore test PostgreSQL (раздел 10)
```

---

## 13. НЕ ХРАНИТЬ В GIT

Следующее **никогда** не должно попадать в репозиторий:

- `.env` и любые production secrets
- database dumps (`*.dump`)
- содержимое MinIO backup
- PostgreSQL password
- MinIO credentials (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`)
- VK Client Secret
- VK Service Token
- любые production tokens / keys

В репозитории хранятся только **шаблоны** (`infra/backup/wkw-backup.sh`, `wkw-backup.cron`) и документация.

---

## 14. Ограничения текущей схемы

Backup хранится **на том же VPS**, что и production.

### Защищает от

- случайного удаления данных;
- повреждения Docker volume;
- ошибочной миграции или операции администратора.

### НЕ защищает от

- полной потери VPS;
- уничтожения диска / datacenter;
- компрометации сервера с удалением backup-директории.

Для максимальной надёжности в будущем рекомендуется добавить **внешний offsite backup** (отдельный S3 / другой сервер / облачное хранилище в РФ согласно требованиям проекта).

---

## Контейнеры production (справка)

| Сервис | Container name |
|--------|----------------|
| PostgreSQL | `wkw-postgres` |
| MinIO | `wkw-minio` |

Переопределение (опционально) через переменные окружения скрипта:

- `WKW_POSTGRES_CONTAINER`
- `WKW_MINIO_CONTAINER`
- `WKW_BACKUP_ROOT`
- `WKW_BACKUP_RETENTION_DAYS`
