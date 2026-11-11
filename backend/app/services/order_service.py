"""Individual order creation and management."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User, UserAddress
from app.services.analytics_service import AnalyticsService
from app.services.inventory_service import InventoryService


def _order_number() -> str:
    return f"PD{datetime.now(timezone.utc).strftime('%Y%m%d')}{secrets.token_hex(4).upper()}"


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.inventory = InventoryService(db)
        self.analytics = AnalyticsService(db)

    async def create_individual_order(
        self,
        user: User,
        product_id: UUID,
        quantity: int,
        address_id: UUID,
        idempotency_key: str,
        promotion_code: Optional[str] = None,
    ) -> Order:
        result = await self.db.execute(
            select(Product)
            .options(selectinload(Product.inventory))
            .where(Product.id == product_id, Product.is_active.is_(True))
        )
        product = result.scalar_one_or_none()
        if product is None:
            raise NotFoundError("Product not found")

        addr_result = await self.db.execute(
            select(UserAddress).where(
                UserAddress.id == address_id, UserAddress.user_id == user.id
            )
        )
        address = addr_result.scalar_one_or_none()
        if address is None:
            raise NotFoundError("Address not found")

        unit_price = product.individual_price
        subtotal = (unit_price * quantity).quantize(Decimal("0.01"))
        shipping = Decimal("0.00") if subtotal >= Decimal("50") else Decimal("4.99")
        tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))
        discount = Decimal("0.00")
        total = subtotal + shipping + tax - discount

        snapshot = json.dumps(
            {
                "recipient_name": address.recipient_name,
                "phone": address.phone,
                "line1": address.line1,
                "line2": address.line2,
                "city": address.city,
                "state": address.state,
                "postal_code": address.postal_code,
                "country": address.country,
            }
        )
        order = Order(
            order_number=_order_number(),
            user_id=user.id,
            purchase_type="individual",
            status="PENDING",
            subtotal=subtotal,
            discount_amount=discount,
            shipping_amount=shipping,
            tax_amount=tax,
            total_amount=total,
            currency=product.currency,
            shipping_address_snapshot=snapshot,
            promotion_code=promotion_code,
        )
        self.db.add(order)
        await self.db.flush()
        self.db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                product_sku=product.sku,
                unit_price=unit_price,
                quantity=quantity,
                line_total=subtotal,
                purchase_type="individual",
            )
        )
        await self.db.flush()

        await self.inventory.reserve(
            product_id=product.id,
            quantity=quantity,
            reference_type="order",
            reference_id=order.id,
            created_by=user.id,
        )
        await self.analytics.track(
            "individual_purchase_started",
            user_id=user.id,
            entity_type="order",
            entity_id=order.id,
            properties={"product_id": str(product.id), "quantity": quantity},
        )
        await self.db.flush()

        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.payments))
            .where(Order.id == order.id)
        )
        return result.scalar_one()

    async def get_order(self, order_id: UUID, user_id: Optional[UUID] = None) -> Order:
        stmt = (
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.refunds),
                selectinload(Order.shipments),
            )
            .where(Order.id == order_id)
        )
        if user_id:
            stmt = stmt.where(Order.user_id == user_id)
        result = await self.db.execute(stmt)
        order = result.scalar_one_or_none()
        if order is None:
            raise NotFoundError("Order not found")
        return order

    async def list_orders(
        self,
        *,
        user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        purchase_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Order], int]:
        stmt = select(Order).options(
            selectinload(Order.items), selectinload(Order.payments)
        )
        count_stmt = select(Order.id)
        if user_id:
            stmt = stmt.where(Order.user_id == user_id)
            count_stmt = count_stmt.where(Order.user_id == user_id)
        if status:
            stmt = stmt.where(Order.status == status)
            count_stmt = count_stmt.where(Order.status == status)
        if purchase_type:
            stmt = stmt.where(Order.purchase_type == purchase_type)
            count_stmt = count_stmt.where(Order.purchase_type == purchase_type)
        total = len(list((await self.db.execute(count_stmt)).scalars().all()))
        result = await self.db.execute(
            stmt.order_by(Order.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().unique().all()), total

    async def update_status(self, order_id: UUID, status: str) -> Order:
        order = await self.get_order(order_id)
        order.status = status
        if status == "CANCELLED":
            order.cancelled_at = datetime.now(timezone.utc)
            await self.inventory.release("order", order.id)
        await self.db.flush()
        return order
