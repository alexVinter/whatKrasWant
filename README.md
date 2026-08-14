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
