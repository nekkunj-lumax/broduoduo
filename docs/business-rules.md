# Business Rules

## Pricing

- Frontend never supplies authoritative prices.
- Backend reads `products.individual_price` / `products.group_price`.
- Taxes default to 8% of subtotal; shipping is `$4.99` under `$50`, otherwise free (configurable later).

## Group success

A group becomes `SUCCESSFUL` only when:

`confirmed_participants >= required_participants`

where confirmed means `payment_status == paid`.

Join clicks and unpaid pending seats do **not** complete a group.

## Capacity

`confirmed_participants + pending_participants` cannot exceed `required_participants`.

## Expiration

- `expires_at` is set from product `group_expiration_hours` at creation.
- Background worker expires open groups when server time passes `expires_at`.
- On expire: unpaid orders cancel + inventory release; paid orders enter refund workflow.

## Inventory

1. Reserve on order create (individual or group)
2. Consume reservation when individual payment succeeds or group succeeds
3. Release on cancel/expire/failed payment paths

Row-level locks prevent overselling.

## Payments

- Default provider: `simulated` (local)
- Optional: Stripe test mode via `PAYMENT_PROVIDER=stripe`
- Idempotency keys prevent duplicate charges
- Webhook signatures verified for Stripe

## Refunds

- Admin-initiated refunds for eligible paid orders
- Automatic refund attempts when groups expire with paid participants
- Refunds are recorded separately from GMV

## KPI formulas

| Metric | Formula |
|--------|---------|
| Group success rate | `successful / (successful + expired + cancelled) × 100` (terminal groups only) |
| Group-buying conversion | `paid group orders / group checkout attempts × 100` |
| AOV | `paid order value / paid orders` |
| Net sales | `paid order value − refunds` |
| GMV | merchandise value of non-cancelled orders (**not profit**) |

## Referrals

Rewards are granted only after registered referred users complete eligible paid conversions (tracked in `referrals`).

## Admin controls

Ordinary admin tools cannot mark unpaid participants as paid. Exceptional financial actions must be audited in `admin_audit_logs`.
