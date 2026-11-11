"""Group-buying engine: create, join, confirm, complete, expire."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, GroupBuyError, NotFoundError
from app.models.group import BuyingGroup, GroupInvitation, GroupParticipant
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User, UserAddress
from app.services.inventory_service import InventoryService
from app.services.notification_service import NotificationService
from app.services.analytics_service import AnalyticsService


def _order_number() -> str:
    return f"PD{datetime.now(timezone.utc).strftime('%Y%m%d')}{secrets.token_hex(4).upper()}"


def _invite_code() -> str:
    return secrets.token_urlsafe(10)[:16]


class GroupService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.inventory = InventoryService(db)
        self.notifications = NotificationService(db)
        self.analytics = AnalyticsService(db)

    async def create_group(
        self,
        user: User,
        product_id: UUID,
        quantity: int,
        address_id: UUID,
        idempotency_key: str,
        required_participants: Optional[int] = None,
        promotion_code: Optional[str] = None,
    ) -> tuple[BuyingGroup, Order]:
        product = await self._get_active_product(product_id)
        if not product.is_group_buy_enabled:
            raise GroupBuyError("Group buying is not enabled for this product")

        address = await self._get_address(user.id, address_id)
        size = required_participants or product.group_size
        if size < 2 or size > product.max_group_size:
            raise GroupBuyError(
                f"Group size must be between 2 and {product.max_group_size}"
            )

        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=product.group_expiration_hours
        )
        group = BuyingGroup(
            product_id=product.id,
            creator_id=user.id,
            required_participants=size,
            confirmed_participants=0,
            pending_participants=1,
            group_price=product.group_price,
            currency=product.currency,
            status="OPEN",
            expires_at=expires_at,
            invite_code=_invite_code(),
        )
        self.db.add(group)
        await self.db.flush()

        invitation = GroupInvitation(
            group_id=group.id,
            created_by_id=user.id,
            invite_token=secrets.token_urlsafe(24),
            expires_at=expires_at,
        )
        self.db.add(invitation)

        order = await self._create_group_order(
            user=user,
            product=product,
            group=group,
            quantity=quantity,
            address=address,
            promotion_code=promotion_code,
        )

        participant = GroupParticipant(
            group_id=group.id,
            user_id=user.id,
            order_id=order.id,
            payment_status="pending",
            quantity=quantity,
            amount=order.total_amount,
            joined_via_invite=False,
        )
        self.db.add(participant)
        await self.db.flush()

        await self.inventory.reserve(
            product_id=product.id,
            quantity=quantity,
            reference_type="order",
            reference_id=order.id,
            expires_at=expires_at,
            created_by=user.id,
        )

        await self.analytics.track(
            "group_created",
            user_id=user.id,
            entity_type="buying_group",
            entity_id=group.id,
            properties={"product_id": str(product.id), "required": size},
        )
        await self.db.flush()
        return group, order

    async def join_group(
        self,
        user: User,
        group_id: UUID,
        quantity: int,
        address_id: UUID,
        idempotency_key: str,
        invite_token: Optional[str] = None,
        promotion_code: Optional[str] = None,
    ) -> tuple[BuyingGroup, Order]:
        group = await self._lock_group(group_id)
        await self._ensure_joinable(group, user.id)

        product = await self._get_active_product(group.product_id)
        address = await self._get_address(user.id, address_id)

        invitation: Optional[GroupInvitation] = None
        if invite_token:
            inv_result = await self.db.execute(
                select(GroupInvitation).where(
                    GroupInvitation.invite_token == invite_token,
                    GroupInvitation.group_id == group.id,
                )
            )
            invitation = inv_result.scalar_one_or_none()
            if invitation:
                invitation.conversion_count += 1

        order = await self._create_group_order(
            user=user,
            product=product,
            group=group,
            quantity=quantity,
            address=address,
            promotion_code=promotion_code,
        )

        participant = GroupParticipant(
            group_id=group.id,
            user_id=user.id,
            order_id=order.id,
            payment_status="pending",
            quantity=quantity,
            amount=order.total_amount,
            joined_via_invite=bool(invitation),
            invitation_id=invitation.id if invitation else None,
        )
        self.db.add(participant)
        group.pending_participants += 1
        await self.db.flush()

        await self.inventory.reserve(
            product_id=product.id,
            quantity=quantity,
            reference_type="order",
            reference_id=order.id,
            expires_at=group.expires_at,
            created_by=user.id,
        )

        await self.analytics.track(
            "group_joined",
            user_id=user.id,
            entity_type="buying_group",
            entity_id=group.id,
            properties={"via_invite": bool(invitation)},
        )
        await self.db.flush()
        return group, order

    async def confirm_participant_payment(self, order: Order) -> BuyingGroup:
        """Called after payment succeeds. Only paid participants count toward success."""
        if not order.buying_group_id:
            raise GroupBuyError("Order is not associated with a buying group")

        group = await self._lock_group(order.buying_group_id)
        result = await self.db.execute(
            select(GroupParticipant)
            .where(
                GroupParticipant.group_id == group.id,
                GroupParticipant.order_id == order.id,
            )
            .with_for_update()
        )
        participant = result.scalar_one_or_none()
        if participant is None:
            raise NotFoundError("Group participant not found")
        if participant.payment_status == "paid":
            return group

        if group.status != "OPEN":
            # Payment arrived after group closed — queue refund path via status
            participant.payment_status = "paid"
            participant.confirmed_at = datetime.now(timezone.utc)
            await self.db.flush()
            return group

        participant.payment_status = "paid"
        participant.confirmed_at = datetime.now(timezone.utc)
        group.pending_participants = max(0, group.pending_participants - 1)
        group.confirmed_participants += 1

        await self.notifications.notify_user(
            participant.user_id,
            title="Joined group successfully",
            body=f"Your group payment is confirmed. Waiting for {group.remaining_participants} more participants.",
            notification_type="group_joined",
            reference_type="buying_group",
            reference_id=group.id,
        )

        if group.confirmed_participants >= group.required_participants:
            await self._complete_group(group)

        await self.db.flush()
        return group

    async def _complete_group(self, group: BuyingGroup) -> None:
        group.status = "SUCCESSFUL"
        group.completed_at = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(GroupParticipant)
            .options(selectinload(GroupParticipant.order))
            .where(
                GroupParticipant.group_id == group.id,
                GroupParticipant.payment_status == "paid",
            )
        )
        participants = list(result.scalars().all())
        for participant in participants:
            if participant.order and participant.order.status == "PAID":
                participant.order.status = "PROCESSING"
                await self.inventory.consume("order", participant.order.id)

        # Cancel pending unpaid participants
        pending = await self.db.execute(
            select(GroupParticipant)
            .options(selectinload(GroupParticipant.order))
            .where(
                GroupParticipant.group_id == group.id,
                GroupParticipant.payment_status == "pending",
            )
        )
        for participant in pending.scalars().all():
            if participant.order and participant.order.status == "PENDING":
                participant.order.status = "CANCELLED"
                participant.order.cancelled_at = datetime.now(timezone.utc)
                await self.inventory.release("order", participant.order.id)
            participant.payment_status = "failed"
            group.pending_participants = max(0, group.pending_participants - 1)

        product = await self.db.get(Product, group.product_id)
        if product:
            product.successful_groups_count += 1

        user_ids = [p.user_id for p in participants]
        await self.notifications.notify_many(
            user_ids,
            title="Group buy succeeded!",
            body="Your buying group is complete. Your order is now being processed.",
            notification_type="group_completed",
            reference_type="buying_group",
            reference_id=group.id,
        )
        await self.analytics.track(
            "group_completed",
            entity_type="buying_group",
            entity_id=group.id,
            properties={"confirmed": group.confirmed_participants},
        )

    async def expire_group(self, group_id: UUID) -> BuyingGroup:
        group = await self._lock_group(group_id)
        if group.status != "OPEN":
            return group
        if group.expires_at > datetime.now(timezone.utc):
            raise GroupBuyError("Group has not expired yet")

        group.status = "EXPIRED"
        result = await self.db.execute(
            select(GroupParticipant)
            .options(selectinload(GroupParticipant.order).selectinload(Order.payments))
            .where(GroupParticipant.group_id == group.id)
        )
        participants = list(result.scalars().all())
        for participant in participants:
            if participant.order:
                if participant.payment_status == "paid":
                    # Refund will be handled by payment/refund workflow
                    from app.services.payment_service import PaymentService

                    payment_service = PaymentService(self.db)
                    try:
                        await payment_service.refund_order(
                            participant.order.id,
                            reason="Group expired before reaching required participants",
                        )
                    except Exception:
                        participant.order.status = "CANCELLED"
                        participant.order.cancelled_at = datetime.now(timezone.utc)
                        await self.inventory.release("order", participant.order.id)
                elif participant.order.status == "PENDING":
                    participant.order.status = "CANCELLED"
                    participant.order.cancelled_at = datetime.now(timezone.utc)
                    await self.inventory.release("order", participant.order.id)
            if participant.payment_status == "pending":
                participant.payment_status = "failed"

        group.pending_participants = 0
        user_ids = [p.user_id for p in participants]
        await self.notifications.notify_many(
            user_ids,
            title="Group buy expired",
            body="The buying group expired before enough participants joined. Eligible refunds are being processed.",
            notification_type="group_expired",
            reference_type="buying_group",
            reference_id=group.id,
        )
        await self.analytics.track(
            "group_expired",
            entity_type="buying_group",
            entity_id=group.id,
        )
        await self.db.flush()
        return group

    async def cancel_group(self, group_id: UUID, user: User) -> BuyingGroup:
        group = await self._lock_group(group_id)
        if group.creator_id != user.id and not user.is_admin:
            raise GroupBuyError("Only the creator or an admin can cancel this group", code="forbidden")
        if group.status != "OPEN":
            raise GroupBuyError("Only open groups can be cancelled")
        if group.confirmed_participants > 0:
            raise GroupBuyError("Cannot cancel a group with confirmed paid participants")

        group.status = "CANCELLED"
        group.cancelled_at = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(GroupParticipant)
            .options(selectinload(GroupParticipant.order))
            .where(GroupParticipant.group_id == group.id)
        )
        for participant in result.scalars().all():
            if participant.order and participant.order.status == "PENDING":
                participant.order.status = "CANCELLED"
                participant.order.cancelled_at = datetime.now(timezone.utc)
                await self.inventory.release("order", participant.order.id)
            participant.payment_status = "failed"
        group.pending_participants = 0
        await self.db.flush()
        return group

    async def expire_due_groups(self) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(BuyingGroup.id).where(
                BuyingGroup.status == "OPEN",
                BuyingGroup.expires_at <= now,
            )
        )
        ids = list(result.scalars().all())
        for group_id in ids:
            await self.expire_group(group_id)
        return len(ids)

    async def get_group(self, group_id: UUID) -> BuyingGroup:
        result = await self.db.execute(
            select(BuyingGroup)
            .options(
                selectinload(BuyingGroup.product).selectinload(Product.images),
                selectinload(BuyingGroup.product).selectinload(Product.inventory),
                selectinload(BuyingGroup.participants).selectinload(GroupParticipant.user),
                selectinload(BuyingGroup.creator),
                selectinload(BuyingGroup.invitations),
            )
            .where(BuyingGroup.id == group_id)
        )
        group = result.scalar_one_or_none()
        if group is None:
            raise NotFoundError("Buying group not found")
        return group

    async def list_open_groups(
        self,
        *,
        category_id: Optional[UUID] = None,
        product_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[BuyingGroup], int]:
        now = datetime.now(timezone.utc)
        filters = [BuyingGroup.status == "OPEN", BuyingGroup.expires_at > now]
        stmt = (
            select(BuyingGroup)
            .options(
                selectinload(BuyingGroup.product).selectinload(Product.images),
                selectinload(BuyingGroup.product).selectinload(Product.inventory),
            )
            .where(and_(*filters))
        )
        if product_id:
            stmt = stmt.where(BuyingGroup.product_id == product_id)
        if category_id:
            stmt = stmt.join(Product).where(Product.category_id == category_id)

        # Prioritize groups closest to completion
        stmt = stmt.order_by(
            (BuyingGroup.required_participants - BuyingGroup.confirmed_participants).asc(),
            BuyingGroup.expires_at.asc(),
        )
        count_result = await self.db.execute(
            select(BuyingGroup.id).where(and_(*filters))
        )
        total = len(list(count_result.scalars().all()))
        result = await self.db.execute(
            stmt.offset((page - 1) * page_size).limit(page_size)
        )
        return list(result.scalars().unique().all()), total

    async def _lock_group(self, group_id: UUID) -> BuyingGroup:
        result = await self.db.execute(
            select(BuyingGroup).where(BuyingGroup.id == group_id).with_for_update()
        )
        group = result.scalar_one_or_none()
        if group is None:
            raise NotFoundError("Buying group not found")
        return group

    async def _ensure_joinable(self, group: BuyingGroup, user_id: UUID) -> None:
        if group.status != "OPEN":
            raise GroupBuyError("Group is not open for joining", code="group_closed")
        if group.expires_at <= datetime.now(timezone.utc):
            raise GroupBuyError("Group has expired", code="group_expired")
        capacity = group.confirmed_participants + group.pending_participants
        if capacity >= group.required_participants:
            raise GroupBuyError("Group is full", code="group_full")

        existing = await self.db.execute(
            select(GroupParticipant).where(
                GroupParticipant.group_id == group.id,
                GroupParticipant.user_id == user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("You have already joined this group")

    async def _get_active_product(self, product_id: UUID) -> Product:
        result = await self.db.execute(
            select(Product)
            .options(selectinload(Product.inventory), selectinload(Product.images))
            .where(Product.id == product_id, Product.is_active.is_(True))
        )
        product = result.scalar_one_or_none()
        if product is None:
            raise NotFoundError("Product not found")
        return product

    async def _get_address(self, user_id: UUID, address_id: UUID) -> UserAddress:
        result = await self.db.execute(
            select(UserAddress).where(
                UserAddress.id == address_id, UserAddress.user_id == user_id
            )
        )
        address = result.scalar_one_or_none()
        if address is None:
            raise NotFoundError("Address not found")
        return address

    async def _create_group_order(
        self,
        user: User,
        product: Product,
        group: BuyingGroup,
        quantity: int,
        address: UserAddress,
        promotion_code: Optional[str],
    ) -> Order:
        unit_price = product.group_price
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
            purchase_type="group",
            buying_group_id=group.id,
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
                purchase_type="group",
            )
        )
        await self.db.flush()
        return order
