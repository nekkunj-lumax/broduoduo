# Development Status

Last updated: 2026-11-11

## Overall

Brodoudou monorepo is implemented as a working full-stack platform:

- Shared FastAPI backend with group-buying engine, payments, inventory, analytics
- Separate customer storefront (`:3000`) and admin BI dashboard (`:3001`)
- PostgreSQL + Redis via Docker Compose
- Seed data, Alembic migrations, backend pytest suite, project docs

## Phase checklist

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Project initialization | **Complete** | Monorepo, Docker Compose, env templates |
| 2. Database & backend APIs | **Complete** | Models, migrations, auth/products/orders/payments/admin |
| 3. Group-buying engine | **Complete** | Create/join/confirm/complete/expire/refund/inventory locks |
| 4. Customer frontend | **Complete** | Browse, groups, cart/checkout, account (API-wired) |
| 5. Admin frontend | **Complete** | Overview KPIs, groups, sales, inventory, reports |
| 6. Real-time | **Mostly complete** | WS endpoints + customer group polling/WS; admin WS optional |
| 7. Testing | **Partial** | Backend pytest 7/7 passing; Playwright E2E not yet added |
| 8. Docs & deployment | **Complete** | README, architecture, schema, API, business rules |

## Verified locally

- `alembic upgrade head` + seed succeeded
- Backend `/health`, `/api/products`, `/api/groups`, admin login + `/api/admin/analytics/overview`
- `pytest tests/` → **7 passed**
- Customer & admin Next.js builds succeed (built by feature agents)

## Seed credentials

- Admin: `admin@pindodo.com` / `Admin123!`
- Customer: `customer1@example.com` / `Customer123!`

## Known gaps / next work

1. Playwright end-to-end suite across both frontends
2. Stronger concurrent join stress tests under load
3. Stripe live webhook end-to-end in test mode (abstraction present; simulated default)
4. Optional Redis-backed rate limiting / session blacklist for refresh tokens
5. Promotion redemption path fully wired in checkout UI
6. Excel export in addition to CSV
7. Product image upload (URLs supported; binary upload storage not yet)

## How to continue in a new session

1. Start `docker compose up -d postgres redis`
2. Run backend (`uvicorn`) and both Next apps
3. Prefer implementing Playwright flows for register → create group → join → pay → success
4. Extend admin realtime toasts on `/ws/admin`

## Key paths

- Backend app: `backend/app/`
- Migration: `backend/migrations/versions/1232dcf399f6_initial_schema.py`
- Seed: `backend/seed/seed_data.py`
- Customer: `apps/customer-web/`
- Admin: `apps/admin-dashboard/`
