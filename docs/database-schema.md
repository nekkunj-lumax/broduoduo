# Database Schema

Primary keys are UUIDs. Monetary fields use `NUMERIC(12,2)`. Timestamps are timezone-aware UTC.

## Core entities

### Identity

- `users` — accounts, referral codes
- `roles`, `permissions`, `user_roles`, `role_permissions`
- `user_addresses`

### Catalog

- `product_categories`
- `products` — individual/group prices, group size, expiration hours
- `product_images`, `product_variants`, `product_reviews`
- `wishlists`

### Inventory

- `inventory` — available / reserved / sold quantities
- `inventory_movements` — audit trail
- `inventory_reservations` — active holds tied to orders/participants

### Group buying

- `buying_groups` — status: `OPEN | SUCCESSFUL | EXPIRED | CANCELLED`
- `group_participants` — unique `(group_id, user_id)`; payment_status `pending|paid|failed|refunded`
- `group_invitations` — share tokens + click/conversion counters

### Commerce

- `orders`, `order_items`
- `payments`, `refunds`, `shipments`
- `promotions`, `promotion_redemptions`
- `idempotency_records`

### Engagement & ops

- `notifications`
- `referrals`
- `analytics_events`
- `admin_audit_logs`

## Important constraints

- Unique group participation per user
- Unique payment idempotency keys
- FK cascades on dependent catalog/order children
- Indexes on status, expires_at, product_id, user_id for monitoring queries

## Entity relationship (simplified)

```
users ──< orders ──< order_items >── products
  │         │                           │
  │         └── payments/refunds        ├── inventory
  │                                     └── buying_groups
  └── group_participants >── buying_groups
```

Migrations live in `backend/migrations/versions/` (Alembic).
