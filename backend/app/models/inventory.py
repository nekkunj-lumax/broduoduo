"""Inventory, movements, and reservation models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.product import Product


class Inventory(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    available_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sold_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="inventory")
    movements: Mapped[list["InventoryMovement"]] = relationship(
        "InventoryMovement", back_populates="inventory", cascade="all, delete-orphan"
    )
    reservations: Mapped[list["InventoryReservation"]] = relationship(
        "InventoryReservation", back_populates="inventory", cascade="all, delete-orphan"
    )

    @property
    def is_low_stock(self) -> bool:
        return self.available_qty <= self.low_stock_threshold


class InventoryMovement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_movements"

    inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False)  # restock, reserve, release, sell, adjust
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    inventory: Mapped[Inventory] = relationship("Inventory", back_populates="movements")


class InventoryReservation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_reservations"

    inventory_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active, released, consumed
    reference_type: Mapped[str] = mapped_column(String(50), nullable=False)  # order, group_participant
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    inventory: Mapped[Inventory] = relationship("Inventory", back_populates="reservations")
