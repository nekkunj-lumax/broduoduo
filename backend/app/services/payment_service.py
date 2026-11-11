"""Payment orchestration with idempotency."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PaymentError
from app.integrations.payments import get_payment_provider
from app.models.audit import IdempotencyRecord
from app.models.order import Order, Payment, Refund
from app.services.group_service import GroupService
from app.services.inventory_service import InventoryService
from app.services.notification_service import NotificationService


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = get_payment_provider()
        self.inventory = InventoryService(db)
        self.notifications = NotificationService(db)

    async def create_payment(
        self,
        order_id: UUID,
        idempotency_key: str,
        user_id: UUID,
        simulate_outcome: str = "success",
    ) -> Payment:
        existing = await self.db.execute(
            select(Payment).where(Payment.idempotency_key == idempotency_key)
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Duplicate payment request")

        idem = await self.db.execute(
            select(IdempotencyRecord).where(IdempotencyRecord.key == idempotency_key)
        )
        if idem.scalar_one_or_none():
            raise ConflictError("Idempotency key already used")

        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.payments))
            .where(Order.id == order_id, Order.user_id == user_id)
            .with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise NotFoundError("Order not found")
        if order.status not in {"PENDING"}:
            raise PaymentError(f"Order status {order.status} is not payable")

        payment = Payment(
            order_id=order.id,
            provider=self.provider.name,
            amount=order.total_amount,
            currency=order.currency,
            status="pending",
            idempotency_key=idempotency_key,
        )
        self.db.add(payment)
        await self.db.flush()

        provider_result = await self.provider.create_payment(
            amount=order.total_amount,
            currency=order.currency,
            metadata={"order_id": str(order.id), "order_number": order.order_number},
            simulate_outcome=simulate_outcome,
        )
        payment.provider_payment_id = provider_result.provider_payment_id
        payment.raw_response = json.dumps(provider_result.raw)
        payment.status = provider_result.status
        if not provider_result.success:
            payment.failure_reason = provider_result.failure_reason
            await self.db.flush()
            raise PaymentError(provider_result.failure_reason or "Payment failed")

        if provider_result.status == "succeeded":
            await self._mark_order_paid(order, payment)

        self.db.add(
            IdempotencyRecord(
                key=idempotency_key,
                request_path="/api/payments/create",
                request_method="POST",
                response_status=200,
                response_body={"payment_id": str(payment.id)},
                user_id=user_id,
            )
        )
        await self.db.flush()
        return payment

    async def confirm_payment(
        self, payment_id: UUID, provider_payment_id: Optional[str] = None
    ) -> Payment:
        result = await self.db.execute(
            select(Payment)
            .options(selectinload(Payment.order).selectinload(Order.items))
            .where(Payment.id == payment_id)
            .with_for_update()
        )
        payment = result.scalar_one_or_none()
        if payment is None:
            raise NotFoundError("Payment not found")
        if payment.status == "succeeded":
            return payment

        pid = provider_payment_id or payment.provider_payment_id
        if not pid:
            raise PaymentError("Missing provider payment id")

        provider_result = await self.provider.confirm_payment(pid)
        payment.raw_response = json.dumps(provider_result.raw)
        payment.status = provider_result.status
        if not provider_result.success:
            payment.failure_reason = provider_result.failure_reason
            await self.db.flush()
            raise PaymentError(provider_result.failure_reason or "Payment confirmation failed")

        await self._mark_order_paid(payment.order, payment)
        return payment

    async def refund_order(
        self,
        order_id: UUID,
        reason: str,
        amount: Optional[Decimal] = None,
    ) -> Refund:
        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.payments), selectinload(Order.items))
            .where(Order.id == order_id)
            .with_for_update()
        )
        order = result.scalar_one_or_none()
        if order is None:
            raise NotFoundError("Order not found")
        if order.status not in {"PAID", "PROCESSING", "SHIPPED", "DELIVERED"}:
            raise PaymentError(f"Cannot refund order in status {order.status}")

        succeeded = next((p for p in order.payments if p.status == "succeeded"), None)
        if succeeded is None:
            raise PaymentError("No succeeded payment to refund")

        refund_amount = amount or order.total_amount
        if refund_amount > order.total_amount:
            raise PaymentError("Refund amount exceeds order total")

        provider_result = await self.provider.refund_payment(
            succeeded.provider_payment_id or "",
            refund_amount,
            reason,
        )
        refund = Refund(
            order_id=order.id,
            payment_id=succeeded.id,
            amount=refund_amount,
            currency=order.currency,
            reason=reason,
            status="succeeded" if provider_result.success else "failed",
            provider_refund_id=provider_result.provider_payment_id,
            processed_at=datetime.now(timezone.utc) if provider_result.success else None,
        )
        self.db.add(refund)
        if provider_result.success:
            order.status = "REFUNDED"
            await self.inventory.release("order", order.id)
            await self.notifications.notify_user(
                order.user_id,
                title="Refund processed",
                body=f"A refund of {refund_amount} {order.currency} was processed for order {order.order_number}.",
                notification_type="refund_processed",
                reference_type="order",
                reference_id=order.id,
            )
        await self.db.flush()
        return refund

    async def _mark_order_paid(self, order: Order, payment: Payment) -> None:
        payment.status = "succeeded"
        payment.confirmed_at = datetime.now(timezone.utc)
        order.status = "PAID"
        order.paid_at = payment.confirmed_at

        if order.purchase_type == "individual":
            await self.inventory.consume("order", order.id)
            order.status = "PROCESSING"
        elif order.purchase_type == "group" and order.buying_group_id:
            group_service = GroupService(self.db)
            await group_service.confirm_participant_payment(order)

        await self.notifications.notify_user(
            order.user_id,
            title="Payment confirmed",
            body=f"Payment for order {order.order_number} was successful.",
            notification_type="payment_completed",
            reference_type="order",
            reference_id=order.id,
        )
        await self.db.flush()
