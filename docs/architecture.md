# Architecture

## Overview

Brodoudou is a monorepo with two independent Next.js frontends and one FastAPI backend sharing PostgreSQL.

```
┌─────────────────┐   ┌──────────────────┐
│ customer-web    │   │ admin-dashboard  │
│ :3000           │   │ :3001            │
└────────┬────────┘   └────────┬─────────┘
         │  REST + WS          │  REST + WS
         └──────────┬──────────┘
                    ▼
           ┌────────────────┐
           │ FastAPI :8000  │
           │ auth, catalog, │
           │ groups, orders │
           │ payments, BI   │
           └───────┬────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   PostgreSQL           Redis
   (source of truth)    (cache / coordination)
```

## Backend layers

- `api/` — HTTP routers and request/response mapping
- `services/` — business rules (group-buying engine, payments, inventory)
- `models/` — SQLAlchemy ORM
- `schemas/` — Pydantic validation
- `integrations/` — payment providers (simulated / Stripe)
- `websocket/` — realtime fan-out
- `workers/` — scheduled expiration / refund workflows
- `analytics/` — KPI aggregation (via `AnalyticsService`)

## Frontend separation

| Concern | Customer | Admin |
|---------|----------|-------|
| Auth storage key | `access_token` | `admin_access_token` |
| Visual system | Coral commerce storefront | Slate/steel BI console |
| Primary jobs | Discover, group buy, checkout | Monitor, manage, analyze |

## Concurrency

Group join/create and inventory mutations use `SELECT … FOR UPDATE` inside transactions so capacity and stock cannot be oversubscribed under concurrent requests.

## Realtime

- `/ws/groups/{id}` — participant/progress updates
- `/ws/admin` — operational events
- `/ws/users/{id}` — notification delivery

Server time remains authoritative for expiration; client countdowns are display-only.
