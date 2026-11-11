# Brodoudou — Social Commerce & Group-Buying Platform

Full-stack social commerce platform with collaborative group buying (inspired by Pinduoduo’s model).

**Repository:** [https://github.com/nekkunj-lumax/broduoduo](https://github.com/nekkunj-lumax/broduoduo)

| App | Description | Local URL |
|-----|-------------|-----------|
| Customer storefront | Browse products, create/join groups, checkout | http://localhost:3000 |
| Admin dashboard | KPIs, group monitoring, inventory, revenue | http://localhost:3001 |
| Shared API | FastAPI + PostgreSQL + Redis | http://localhost:8000 |
| API docs | Swagger / OpenAPI | http://localhost:8000/docs |

Both frontends use the **same backend and database**.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) 18+
- Python 3.12+ (3.13 OK)
- [`uv`](https://github.com/astral-sh/uv) *(recommended)* or `pip`

---

## Clone the project

```bash
git clone https://github.com/nekkunj-lumax/broduoduo.git
cd broduoduo
```

---

## Run locally (recommended)

### 1. Environment

```bash
cp .env.example .env
```

Default ports (chosen to avoid common local conflicts):

| Service | Port |
|---------|------|
| Customer web | 3000 |
| Admin dashboard | 3001 |
| Backend API | 8000 |
| PostgreSQL | 5433 |
| Redis | 6380 |

### 2. Start PostgreSQL + Redis

```bash
docker compose up -d postgres redis
```

Wait until Postgres is healthy:

```bash
docker compose exec postgres pg_isready -U pindodo -d pindodo
```

### 3. Backend API

```bash
cd backend
uv venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# Load env vars from repo root
set -a && source ../.env && set +a

PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python -m seed.seed_data
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Leave this terminal running. Confirm: http://localhost:8000/health

### 4. Customer frontend

```bash
cd apps/customer-web
cp .env.local.example .env.local
npm install
npm run dev
```

Open: http://localhost:3000

### 5. Admin frontend

```bash
cd apps/admin-dashboard
cp .env.local.example .env.local
npm install
npm run dev
```

Open: http://localhost:3001/overview

---

## Run everything with Docker

From the repo root (after copying `.env`):

```bash
docker compose up --build
```

This starts Postgres, Redis, backend, worker, customer web, and admin dashboard.

---

## Seed login credentials

| Role | Email | Password |
|------|-------|----------|
| Owner / Admin | `admin@pindodo.com` | `Admin123!` |
| Admin | `manager@pindodo.com` | `Admin123!` |
| Staff | `staff@pindodo.com` | `Staff123!` |
| Customer | `customer1@example.com` … `customer20@example.com` | `Customer123!` |

Local demo builds may auto-sign in so you can explore without typing credentials.

Seed data includes products, categories, open/successful/expired groups, orders, payments, and refunds.

---

## Project structure

```
apps/customer-web/       # Next.js customer storefront (:3000)
apps/admin-dashboard/    # Next.js admin BI dashboard (:3001)
backend/                 # FastAPI + SQLAlchemy + Alembic
  app/                   # API, models, services, websockets, workers
  migrations/            # Database migrations
  seed/                  # Development seed data
  tests/                 # Pytest suite
infrastructure/          # Docker / Nginx helpers
docs/                    # Architecture, schema, API, business rules
scripts/                 # Helper scripts
docker-compose.yml
.env.example
```

---

## Testing

```bash
cd backend
source .venv/bin/activate
set -a && source ../.env && set +a
PYTHONPATH=. pytest tests/ -q
```

---

## Group-buying rules (server-enforced)

- Only **confirmed paid** participants count toward group success
- Pending payments do **not** fill capacity as confirmed seats
- Duplicate joins are rejected
- Capacity and expiration use row locks
- Inventory is reserved on create/join and released on cancel/expire
- Payments are idempotent (simulated provider by default; Stripe-ready)

---

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [API overview](docs/api-documentation.md)
- [Business rules](docs/business-rules.md)
- [Development status](DEVELOPMENT_STATUS.md)

---

## Troubleshooting

**Port 5432 / 6379 already in use**  
This project maps Postgres to **5433** and Redis to **6380** by default. Confirm `.env` matches `docker-compose.yml`.

**Backend can’t connect to the database**  
Ensure containers are up (`docker compose ps`) and `DATABASE_URL` uses `localhost:5433`.

**Frontends show empty data / auth errors**  
Confirm the API is on http://localhost:8000 and `NEXT_PUBLIC_API_URL` in each app’s `.env.local` points there.

**CORS errors**  
`.env` `CORS_ORIGINS` must include `http://localhost:3000` and `http://localhost:3001`.
