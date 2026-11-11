"""Inventory reservation and stock management with concurrency controls."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import InventoryError, NotFoundError
from app.models.inventory import Inventory, InventoryMovement, InventoryReservation
from app.models.product import Product


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_for_product(self, product_id: UUID, *, for_update: bool = False) -> Inventory:
        stmt = (
            select(Inventory)
            .where(Inventory.product_id == product_id)
            .options(selectinload(Inventory.product))
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        inventory = result.scalar_one_or_none()
        if inventory is None:
            raise NotFoundError("Inventory not found for product")
        return inventory

    async def reserve(
        self,
        product_id: UUID,
        quantity: int,
        reference_type: str,
        reference_id: UUID,
        expires_at: Optional[datetime] = None,
        created_by: Optional[UUID] = None,
    ) -> InventoryReservation:
        inventory = await self.get_for_product(product_id, for_update=True)
        if inventory.available_qty < quantity:
            raise InventoryError(
                f"Insufficient stock: need {quantity}, available {inventory.available_qty}"
            )

        inventory.available_qty -= quantity
        inventory.reserved_qty += quantity

        reservation = InventoryReservation(
            inventory_id=inventory.id,
            quantity=quantity,
            status="active",
            reference_type=reference_type,
            reference_id=reference_id,
            expires_at=expires_at,
        )
        self.db.add(reservation)
        self.db.add(
            InventoryMovement(
                inventory_id=inventory.id,
                movement_type="reserve",
                quantity=-quantity,
                reference_type=reference_type,
                reference_id=reference_id,
                notes=f"Reserved {quantity} units",
                created_by=created_by,
            )
        )
        await self.db.flush()
        return reservation

    async def release(
        self,
        reference_type: str,
        reference_id: UUID,
        created_by: Optional[UUID] = None,
    ) -> int:
        result = await self.db.execute(
            select(InventoryReservation)
            .where(
                InventoryReservation.reference_type == reference_type,
                InventoryReservation.reference_id == reference_id,
                InventoryReservation.status == "active",
            )
            .with_for_update()
        )
        reservations = list(result.scalars().all())
        released = 0
        for reservation in reservations:
            inventory = await self.db.get(Inventory, reservation.inventory_id, with_for_update=True)
            if inventory is None:
                continue
            inventory.available_qty += reservation.quantity
            inventory.reserved_qty = max(0, inventory.reserved_qty - reservation.quantity)
            reservation.status = "released"
            released += reservation.quantity
            self.db.add(
                InventoryMovement(
                    inventory_id=inventory.id,
                    movement_type="release",
                    quantity=reservation.quantity,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    notes=f"Released {reservation.quantity} units",
                    created_by=created_by,
                )
            )
        await self.db.flush()
        return released

    async def consume(
        self,
        reference_type: str,
        reference_id: UUID,
        created_by: Optional[UUID] = None,
    ) -> int:
        result = await self.db.execute(
            select(InventoryReservation)
            .where(
                InventoryReservation.reference_type == reference_type,
                InventoryReservation.reference_id == reference_id,
                InventoryReservation.status == "active",
            )
            .with_for_update()
        )
        reservations = list(result.scalars().all())
        consumed = 0
        for reservation in reservations:
            inventory = await self.db.get(Inventory, reservation.inventory_id, with_for_update=True)
            if inventory is None:
                continue
            inventory.reserved_qty = max(0, inventory.reserved_qty - reservation.quantity)
            inventory.sold_qty += reservation.quantity
            reservation.status = "consumed"
            consumed += reservation.quantity
            self.db.add(
                InventoryMovement(
                    inventory_id=inventory.id,
                    movement_type="sell",
                    quantity=-reservation.quantity,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    notes=f"Sold {reservation.quantity} units",
                    created_by=created_by,
                )
            )
            if inventory.product_id:
                product = await self.db.get(Product, inventory.product_id)
                if product:
                    product.units_sold += reservation.quantity
        await self.db.flush()
        return consumed

    async def adjust_stock(
        self,
        product_id: UUID,
        quantity_delta: int,
        notes: str,
        created_by: Optional[UUID] = None,
    ) -> Inventory:
        inventory = await self.get_for_product(product_id, for_update=True)
        new_qty = inventory.available_qty + quantity_delta
        if new_qty < 0:
            raise InventoryError("Resulting stock cannot be negative")
        inventory.available_qty = new_qty
        self.db.add(
            InventoryMovement(
                inventory_id=inventory.id,
                movement_type="adjust" if quantity_delta != 0 else "restock",
                quantity=quantity_delta,
                reference_type="manual",
                notes=notes,
                created_by=created_by,
            )
        )
        await self.db.flush()
        return inventory
