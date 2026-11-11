"""Payment endpoints."""

from fastapi import APIRouter, Header, Request

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.integrations.payments import get_payment_provider
from app.schemas.order import (
    PaymentConfirmRequest,
    PaymentCreateRequest,
    PaymentOut,
    RefundRequest,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/create", response_model=PaymentOut)
async def create_payment(data: PaymentCreateRequest, db: DbSession, user: CurrentUser):
    service = PaymentService(db)
    payment = await service.create_payment(
        order_id=data.order_id,
        idempotency_key=data.idempotency_key,
        user_id=user.id,
        simulate_outcome=data.simulate_outcome or "success",
    )
    return PaymentOut.model_validate(payment)


@router.post("/confirm", response_model=PaymentOut)
async def confirm_payment(data: PaymentConfirmRequest, db: DbSession, user: CurrentUser):
    service = PaymentService(db)
    payment = await service.confirm_payment(data.payment_id, data.provider_payment_id)
    return PaymentOut.model_validate(payment)


@router.post("/refund")
async def refund_payment(data: RefundRequest, db: DbSession, admin: AdminUser):
    service = PaymentService(db)
    refund = await service.refund_order(data.order_id, data.reason, data.amount)
    return {
        "id": str(refund.id),
        "status": refund.status,
        "amount": float(refund.amount),
        "reason": refund.reason,
    }


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: DbSession,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    provider = get_payment_provider()
    payload = await request.body()
    event = provider.verify_webhook(payload, stripe_signature or "simulated")
    return {"received": True, "type": event.get("type")}
