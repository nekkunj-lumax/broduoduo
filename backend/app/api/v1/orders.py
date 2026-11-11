"""Order endpoints."""

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models.audit import AdminAuditLog
from app.schemas.common import PaginatedResponse
from app.schemas.order import IndividualOrderCreate, OrderOut, OrderStatusUpdate
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderOut)
async def create_order(data: IndividualOrderCreate, db: DbSession, user: CurrentUser):
    service = OrderService(db)
    order = await service.create_individual_order(
        user=user,
        product_id=data.product_id,
        quantity=data.quantity,
        address_id=data.address_id,
        idempotency_key=data.idempotency_key,
        promotion_code=data.promotion_code,
    )
    return OrderOut.model_validate(order)


@router.get("", response_model=PaginatedResponse[OrderOut])
async def list_my_orders(
    db: DbSession,
    user: CurrentUser,
    status: Optional[str] = None,
    purchase_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    service = OrderService(db)
    orders, total = await service.list_orders(
        user_id=user.id,
        status=status,
        purchase_type=purchase_type,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        items=[OrderOut.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: UUID, db: DbSession, user: CurrentUser):
    service = OrderService(db)
    order = await service.get_order(order_id, user_id=None if user.is_admin else user.id)
    return OrderOut.model_validate(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: UUID, data: OrderStatusUpdate, db: DbSession, admin: AdminUser
):
    service = OrderService(db)
    order = await service.update_status(order_id, data.status)
    db.add(
        AdminAuditLog(
            actor_id=admin.id,
            action="order.status_update",
            resource_type="order",
            resource_id=order.id,
            details={"status": data.status},
        )
    )
    await db.flush()
    return OrderOut.model_validate(order)
