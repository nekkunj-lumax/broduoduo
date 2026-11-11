"""Buying group, participant, and invitation models."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.product import Product
    from app.models.user import User


class BuyingGroup(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "buying_groups"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    required_participants: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmed_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pending_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    group_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="OPEN", nullable=False, index=True
    )  # OPEN, SUCCESSFUL, EXPIRED, CANCELLED
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    invite_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)

    product: Mapped["Product"] = relationship("Product", back_populates="buying_groups")
    creator: Mapped["User"] = relationship(
        "User", back_populates="created_groups", foreign_keys=[creator_id]
    )
    participants: Mapped[List["GroupParticipant"]] = relationship(
        "GroupParticipant", back_populates="group", cascade="all, delete-orphan"
    )
    invitations: Mapped[List["GroupInvitation"]] = relationship(
        "GroupInvitation", back_populates="group", cascade="all, delete-orphan"
    )

    @property
    def remaining_participants(self) -> int:
        return max(0, self.required_participants - self.confirmed_participants)

    @property
    def progress_percent(self) -> float:
        if self.required_participants <= 0:
            return 0.0
        return round(
            (self.confirmed_participants / self.required_participants) * 100, 2
        )

    @property
    def is_open(self) -> bool:
        return self.status == "OPEN"


class GroupParticipant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_participants"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_participant"),
    )

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("buying_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )
    payment_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # pending, paid, failed, refunded
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    joined_via_invite: Mapped[bool] = mapped_column(default=False, nullable=False)
    invitation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("group_invitations.id"), nullable=True
    )
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    group: Mapped[BuyingGroup] = relationship("BuyingGroup", back_populates="participants")
    user: Mapped["User"] = relationship("User", back_populates="group_participations")
    order: Mapped[Optional["Order"]] = relationship("Order", back_populates="group_participant")


class GroupInvitation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_invitations"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("buying_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    invite_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    click_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    conversion_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    group: Mapped[BuyingGroup] = relationship("BuyingGroup", back_populates="invitations")
