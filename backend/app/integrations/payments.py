"""Payment provider abstraction with simulated and Stripe implementations."""

from __future__ import annotations

import secrets
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any, Optional

import stripe

from app.core.config import settings


class PaymentResult:
    def __init__(
        self,
        success: bool,
        provider_payment_id: str,
        status: str,
        raw: Optional[dict[str, Any]] = None,
        failure_reason: Optional[str] = None,
    ):
        self.success = success
        self.provider_payment_id = provider_payment_id
        self.status = status
        self.raw = raw or {}
        self.failure_reason = failure_reason


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    async def create_payment(
        self,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
        simulate_outcome: str = "success",
    ) -> PaymentResult:
        raise NotImplementedError

    @abstractmethod
    async def confirm_payment(self, provider_payment_id: str) -> PaymentResult:
        raise NotImplementedError

    @abstractmethod
    async def refund_payment(
        self, provider_payment_id: str, amount: Decimal, reason: str
    ) -> PaymentResult:
        raise NotImplementedError

    def verify_webhook(self, payload: bytes, signature: str) -> dict[str, Any]:
        raise NotImplementedError


class SimulatedPaymentProvider(PaymentProvider):
    name = "simulated"

    async def create_payment(
        self,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
        simulate_outcome: str = "success",
    ) -> PaymentResult:
        payment_id = f"sim_{secrets.token_hex(12)}"
        if simulate_outcome == "failure":
            return PaymentResult(
                success=False,
                provider_payment_id=payment_id,
                status="failed",
                raw={"amount": str(amount), "currency": currency, "metadata": metadata},
                failure_reason="Simulated payment failure",
            )
        return PaymentResult(
            success=True,
            provider_payment_id=payment_id,
            status="succeeded",
            raw={"amount": str(amount), "currency": currency, "metadata": metadata},
        )

    async def confirm_payment(self, provider_payment_id: str) -> PaymentResult:
        return PaymentResult(
            success=True,
            provider_payment_id=provider_payment_id,
            status="succeeded",
            raw={"confirmed": True},
        )

    async def refund_payment(
        self, provider_payment_id: str, amount: Decimal, reason: str
    ) -> PaymentResult:
        return PaymentResult(
            success=True,
            provider_payment_id=f"re_{secrets.token_hex(10)}",
            status="succeeded",
            raw={
                "original": provider_payment_id,
                "amount": str(amount),
                "reason": reason,
            },
        )

    def verify_webhook(self, payload: bytes, signature: str) -> dict[str, Any]:
        return {"type": "simulated.event", "data": {"object": {"id": signature}}}


class StripePaymentProvider(PaymentProvider):
    name = "stripe"

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_secret_key

    async def create_payment(
        self,
        amount: Decimal,
        currency: str,
        metadata: dict[str, Any],
        simulate_outcome: str = "success",
    ) -> PaymentResult:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency=currency.lower(),
            metadata={k: str(v) for k, v in metadata.items()},
            automatic_payment_methods={"enabled": True},
        )
        return PaymentResult(
            success=intent.status in {"succeeded", "requires_action", "requires_confirmation"},
            provider_payment_id=intent.id,
            status=intent.status,
            raw=intent.to_dict_recursive(),
        )

    async def confirm_payment(self, provider_payment_id: str) -> PaymentResult:
        intent = stripe.PaymentIntent.retrieve(provider_payment_id)
        return PaymentResult(
            success=intent.status == "succeeded",
            provider_payment_id=intent.id,
            status=intent.status,
            raw=intent.to_dict_recursive(),
            failure_reason=None if intent.status == "succeeded" else intent.status,
        )

    async def refund_payment(
        self, provider_payment_id: str, amount: Decimal, reason: str
    ) -> PaymentResult:
        refund = stripe.Refund.create(
            payment_intent=provider_payment_id,
            amount=int(amount * 100),
            reason="requested_by_customer",
            metadata={"reason": reason},
        )
        return PaymentResult(
            success=refund.status in {"succeeded", "pending"},
            provider_payment_id=refund.id,
            status=refund.status,
            raw=refund.to_dict_recursive(),
        )

    def verify_webhook(self, payload: bytes, signature: str) -> dict[str, Any]:
        event = stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
        return event


def get_payment_provider() -> PaymentProvider:
    if settings.payment_provider == "stripe" and not settings.simulate_payments:
        return StripePaymentProvider()
    return SimulatedPaymentProvider()
