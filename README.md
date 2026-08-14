# Чего хочет Красноярск?

Веб-платформа для сбора, картографического отображения, модерации и рейтингования
городских инициатив Красноярска.

Этот репозиторий — монорепозиторий на npm workspaces. На текущем этапе (E00)
поднято только базовое dev-окружение; бизнес-логика ещё не реализована.

## Структура репозитория

```
.
├── AGENTS.md            # правила и приоритеты для разработки
├── docs/                # ТЗ, решения заказчика, макеты, визуальные референсы
├── web/                 # frontend: React + TypeScript + Vite
├── api/                 # backend: NestJS + TypeScript
├── infra/nginx/         # конфигурация reverse proxy для dev
├── docker-compose.yml   # postgres, minio, api, web, nginx
├── .env.example         # пример переменных окружения
└── package.json         # корневой workspace (web + api)
```

## Требования

- Node.js 20+ (разрабатывалось на Node 24)
- npm 10+
- Docker и Docker Compose (для полного локального окружения)

## Быстрый старт через Docker Compose

1. Скопируйте пример переменных окружения:

```bash
cp .env.example .env
```

2. Поднимите окружение:

```bash
docker compose up --build
```

3. Остановить окружение:

```bash
docker compose down
```

(добавьте `-v`, чтобы удалить тома с данными PostgreSQL и MinIO)

## Локальные адреса (dev)

- Frontend через Nginx: http://localhost:8080
- Backend (напрямую): http://localhost:3000
- API через Nginx: http://localhost:8080/api
- MinIO Console: http://localhost:9001
- MinIO S3 API: http://localhost:9000
- PostgreSQL: localhost:5432

Порты задаются в `.env` (`NGINX_PORT`, `API_PORT`, `MINIO_CONSOLE_PORT` и т. д.).

## Запуск без Docker (при необходимости)

Установите зависимости всех workspace-ов из корня:

```bash
npm install
```

Frontend (Vite dev server):

```bash
npm run dev:web
```

Backend (NestJS, watch-режим):

```bash
npm run dev:api
```

## Полезные команды (из корня)

```bash
npm run typecheck   # проверка типов web + api
npm run lint        # ESLint web + api
npm run build       # production-сборка web + api
```

## База данных (Prisma)

Схема находится в `api/prisma/schema.prisma`, seed — в `api/prisma/seed.ts`,
миграции — в `api/prisma/migrations/`. ORM — Prisma 6.

PostgreSQL поднимается через Docker Compose (сервис `postgres`, порт 5432
проброшен на хост). Prisma CLI удобнее запускать с хоста, указывая
`DATABASE_URL` на `localhost` (в отличие от значения в `.env`, где host —
это имя сервиса `postgres`, доступное только внутри docker-сети).

Windows PowerShell (из папки `api/`):

```powershell
# URL для запуска Prisma CLI с хоста против compose-Postgres
$env:DATABASE_URL = "postgresql://wkw:wkw_dev_password@localhost:5432/wkw?schema=public"

npm run prisma:generate     # сгенерировать Prisma Client
npm run prisma:migrate -- --name init_release1_core   # создать и применить dev-миграцию
npm run prisma:deploy       # применить уже существующие миграции (prod-стиль)
npm run prisma:seed         # заполнить категории/районы/feature flags (идемпотентно)
npm run prisma:status       # статус миграций

Remove-Item Env:DATABASE_URL  # очистить перед docker compose
```

Важно: не оставляйте `DATABASE_URL` со значением `localhost` в переменных
окружения оболочки при запуске `docker compose` — иначе значение подставится
в контейнер `api`. Для контейнеров host всегда `postgres` (берётся из `.env`).

Prisma Client в контейнере `api` генерируется во время сборки образа
(`prisma generate` в `api/Dockerfile`).

## Административная авторизация (E03)

Внутренние маршруты NestJS (внешние — с префиксом `/api` через Nginx):

- `POST /admin/auth/login` — логин по `login`+`password`, выдаёт HttpOnly cookie `wkw_admin_session`;
- `GET  /admin/auth/session` — текущий администратор (нужна валидная сессия);
- `POST /admin/auth/logout` — завершить текущую сессию;
- `POST /admin/auth/logout-all` — завершить все сессии текущего администратора.

Пароли хранятся как Argon2-хэш, session token хранится в БД только как SHA-256 hash.

Создание первого dev-администратора (значения берутся из окружения, секреты не
коммитятся). Windows PowerShell из папки `api/`:

```powershell
$env:DATABASE_URL = "postgresql://wkw:wkw_dev_password@localhost:5432/wkw?schema=public"
$env:ADMIN_BOOTSTRAP_LOGIN = "admin"
$env:ADMIN_BOOTSTRAP_PASSWORD = "<dev-password>"
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.com"

npm run admin:create        # из папки api/  (или: npm run admin:create -w api из корня)

Remove-Item Env:DATABASE_URL, Env:ADMIN_BOOTSTRAP_PASSWORD
```

`ADMIN_SESSION_TTL_HOURS` задаёт срок жизни сессии (по умолчанию 24 часа).
В production cookie выставляется с `Secure=true`; в локальном dev через http — `Secure=false`.
