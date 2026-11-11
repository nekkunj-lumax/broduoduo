"""Order and payment schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class OrderItemOut(ORMModel):
    id: UUID
    product_id: UUID
    product_name: str
    product_sku: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    purchase_type: str


class PaymentOut(ORMModel):
    id: UUID
    provider: str
    provider_payment_id: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    confirmed_at: Optional[datetime] = None


class OrderOut(ORMModel):
    id: UUID
    order_number: str
    user_id: UUID
    purchase_type: str
    buying_group_id: Optional[UUID] = None
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    shipping_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    paid_at: Optional[datetime] = None
    created_at: datetime
    items: List[OrderItemOut] = []
    payments: List[PaymentOut] = []


class IndividualOrderCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=20)
    address_id: UUID
    promotion_code: Optional[str] = None
    idempotency_key: str = Field(min_length=8, max_length=100)


class PaymentCreateRequest(BaseModel):
    order_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=100)
    simulate_outcome: Optional[str] = Field(
        default="success", description="success|failure for simulated provider"
    )


class PaymentConfirmRequest(BaseModel):
    payment_id: UUID
    provider_payment_id: Optional[str] = None


class RefundRequest(BaseModel):
    order_id: UUID
    reason: str = Field(min_length=3, max_length=255)
    amount: Optional[Decimal] = None


class OrderStatusUpdate(BaseModel):
    status: str
