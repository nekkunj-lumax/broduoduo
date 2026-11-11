"""Admin management and analytics endpoints."""

from datetime import datetime
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import csv
import io

from app.core.deps import AdminUser, DbSession
from app.core.exceptions import NotFoundError
from app.models.audit import AdminAuditLog
from app.models.group import BuyingGroup, GroupParticipant
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.group import GroupDetail, ParticipantOut
from app.schemas.order import OrderOut
from app.schemas.product import ProductListItem
from app.services.analytics_service import AnalyticsService
from app.services.group_service import GroupService
from app.services.inventory_service import InventoryService
from app.api.v1.groups import _group_out, _product_item
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


class InventoryAdjust(BaseModel):
    product_id: UUID
    quantity_delta: int
    notes: str = "Manual adjustment"


@router.get("/analytics/overview")
async def analytics_overview(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    return await AnalyticsService(db).overview(start, end)


@router.get("/analytics/sales")
async def analytics_sales(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    return await AnalyticsService(db).product_sales(start, end)


@router.get("/analytics/products")
async def analytics_products(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    return await AnalyticsService(db).product_sales(start, end)


@router.get("/analytics/groups")
async def analytics_groups(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    return await AnalyticsService(db).group_analytics(start, end)


@router.get("/analytics/customers")
async def analytics_customers(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    overview = await AnalyticsService(db).overview(start, end)
    return {
        "total_customers": overview["total_customers"],
        "new_customers": overview["new_customers"],
        "active_customers": overview["active_customers"],
        "period_start": overview["period_start"],
        "period_end": overview["period_end"],
    }


@router.get("/analytics/revenue")
async def analytics_revenue(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    service = AnalyticsService(db)
    overview = await service.overview(start, end)
    breakdown = await service.revenue_breakdown(start, end)
    return {**overview, **breakdown}


@router.get("/groups", response_model=PaginatedResponse[dict])
async def admin_list_groups(
    db: DbSession,
    _: AdminUser,
    status: Optional[str] = None,
    product_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = select(BuyingGroup).options(
        selectinload(BuyingGroup.product).selectinload(Product.images),
        selectinload(BuyingGroup.product).selectinload(Product.inventory),
        selectinload(BuyingGroup.creator),
        selectinload(BuyingGroup.participants),
    )
    if status:
        stmt = stmt.where(BuyingGroup.status == status)
    if product_id:
        stmt = stmt.where(BuyingGroup.product_id == product_id)
    count_stmt = select(BuyingGroup.id)
    if status:
        count_stmt = count_stmt.where(BuyingGroup.status == status)
    if product_id:
        count_stmt = count_stmt.where(BuyingGroup.product_id == product_id)
    total = len(list((await db.execute(count_stmt)).scalars().all()))
    result = await db.execute(
        stmt.order_by(BuyingGroup.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for g in result.scalars().unique().all():
        out = _group_out(g).model_dump(mode="json")
        out["creator_name"] = g.creator.full_name if g.creator else None
        out["total_confirmed_payment"] = float(
            sum(p.amount for p in g.participants if p.payment_status == "paid")
        )
        items.append(out)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/groups/{group_id}", response_model=GroupDetail)
async def admin_group_detail(group_id: UUID, db: DbSession, _: AdminUser):
    service = GroupService(db)
    group = await service.get_group(group_id)
    participants = [
        ParticipantOut(
            id=p.id,
            user_id=p.user_id,
            payment_status=p.payment_status,
            quantity=p.quantity,
            amount=p.amount,
            joined_via_invite=p.joined_via_invite,
            confirmed_at=p.confirmed_at,
            created_at=p.created_at,
            user_first_name=p.user.first_name if p.user else None,
            user_last_name=p.user.last_name if p.user else None,
        )
        for p in group.participants
    ]
    base = _group_out(group)
    return GroupDetail(
        **base.model_dump(),
        participants=participants,
        creator_name=group.creator.full_name if group.creator else None,
    )


@router.get("/orders", response_model=PaginatedResponse[OrderOut])
async def admin_orders(
    db: DbSession,
    _: AdminUser,
    status: Optional[str] = None,
    purchase_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from app.services.order_service import OrderService

    service = OrderService(db)
    orders, total = await service.list_orders(
        status=status, purchase_type=purchase_type, page=page, page_size=page_size
    )
    return PaginatedResponse(
        items=[OrderOut.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/customers", response_model=PaginatedResponse[dict])
async def admin_customers(
    db: DbSession,
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    total = len(list((await db.execute(select(User.id))).scalars().all()))
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [
        {
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_active": u.is_active,
            "roles": [r.name for r in u.roles],
            "created_at": u.created_at.isoformat(),
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in result.scalars().unique().all()
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/products", response_model=PaginatedResponse[ProductListItem])
async def admin_products(
    db: DbSession,
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    total = len(list((await db.execute(select(Product.id))).scalars().all()))
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.inventory))
        .order_by(Product.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for p in result.scalars().unique().all():
        item = _product_item(p)
        if item:
            items.append(item)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/inventory")
async def admin_inventory(db: DbSession, _: AdminUser):
    result = await db.execute(
        select(Inventory).options(selectinload(Inventory.product))
    )
    rows = []
    for inv in result.scalars().unique().all():
        rows.append(
            {
                "product_id": str(inv.product_id),
                "sku": inv.product.sku if inv.product else None,
                "name": inv.product.name if inv.product else None,
                "available_qty": inv.available_qty,
                "reserved_qty": inv.reserved_qty,
                "sold_qty": inv.sold_qty,
                "is_low_stock": inv.is_low_stock,
                "low_stock_threshold": inv.low_stock_threshold,
            }
        )
    return {"items": rows}


@router.post("/inventory/adjust")
async def adjust_inventory(data: InventoryAdjust, db: DbSession, admin: AdminUser):
    service = InventoryService(db)
    inventory = await service.adjust_stock(
        data.product_id, data.quantity_delta, data.notes, created_by=admin.id
    )
    db.add(
        AdminAuditLog(
            actor_id=admin.id,
            action="inventory.adjust",
            resource_type="product",
            resource_id=data.product_id,
            details={"quantity_delta": data.quantity_delta, "notes": data.notes},
        )
    )
    await db.flush()
    return {
        "product_id": str(inventory.product_id),
        "available_qty": inventory.available_qty,
        "reserved_qty": inventory.reserved_qty,
    }


@router.get("/audit-logs")
async def audit_logs(
    db: DbSession,
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    result = await db.execute(
        select(AdminAuditLog)
        .order_by(AdminAuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [
        {
            "id": str(log.id),
            "actor_id": str(log.actor_id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in result.scalars().all()
    ]


@router.get("/reports/sales.csv")
async def export_sales_csv(
    db: DbSession,
    _: AdminUser,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    rows = await AnalyticsService(db).product_sales(start, end)
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "product_id",
            "name",
            "sku",
            "individual_price",
            "group_price",
            "units_sold",
            "revenue",
            "individual_units",
            "group_units",
        ],
    )
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sales_report.csv"},
    )
