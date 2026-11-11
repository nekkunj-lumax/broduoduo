# API Documentation

Interactive OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Base path: `/api`

## Authentication

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` | Creates customer + tokens |
| POST | `/auth/login` | Returns access + refresh JWT |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Client-side discard |
| GET | `/auth/me` | Current user + roles |

Use `Authorization: Bearer <access_token>`.

## Products

| Method | Path |
|--------|------|
| GET | `/products` |
| GET | `/products/{id}` |
| GET | `/products/categories` |
| POST/PUT/DELETE | `/products` (admin) |

Supports search, category, price, discount, group-buy filters, sorting, pagination.

## Group buying

| Method | Path |
|--------|------|
| GET | `/groups` |
| GET | `/groups/{id}` |
| POST | `/groups` |
| POST | `/groups/{id}/join` |
| POST | `/groups/{id}/cancel` |
| GET | `/groups/{id}/participants` |
| GET | `/groups/{id}/status` |

Create/join return `{ group, order }`. Payment is a separate step.

## Orders & payments

| Method | Path |
|--------|------|
| POST | `/orders` |
| GET | `/orders` |
| GET | `/orders/{id}` |
| PATCH | `/orders/{id}/status` |
| POST | `/payments/create` |
| POST | `/payments/confirm` |
| POST | `/payments/refund` |
| POST | `/payments/webhook` |

`idempotency_key` is required on payable mutations.

## Customer

Profile, addresses, orders, groups, notifications under `/customers/*`.

## Admin

| Path | Purpose |
|------|---------|
| `/admin/analytics/overview` | KPI board |
| `/admin/analytics/sales` | Product sales |
| `/admin/analytics/groups` | Group performance |
| `/admin/analytics/revenue` | GMV / net sales |
| `/admin/groups` | Group monitoring |
| `/admin/orders` | Order ops |
| `/admin/customers` | Customer list |
| `/admin/products` | Catalog admin |
| `/admin/inventory` | Stock levels |
| `/admin/audit-logs` | Audit trail |
| `/admin/reports/sales.csv` | CSV export |

Admin endpoints require roles `admin`, `owner`, or `staff`.

## WebSockets

- `WS /ws/groups/{group_id}`
- `WS /ws/admin`
- `WS /ws/users/{user_id}`

## Errors

```json
{ "detail": "Human readable message", "code": "machine_code" }
```
