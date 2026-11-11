"""Group-buying endpoints."""

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.schemas.common import PaginatedResponse
from app.schemas.group import (
    GroupCreateRequest,
    GroupDetail,
    GroupJoinRequest,
    GroupOut,
    GroupStatusOut,
    ParticipantOut,
)
from app.schemas.order import OrderOut
from app.schemas.product import ProductListItem
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["Group Buying"])


def _loaded(obj, attr: str):
    """Return a relationship only if already eager-loaded (no async lazy IO)."""
    if obj is None:
        return None
    return getattr(obj, "__dict__", {}).get(attr)


def _product_item(product) -> Optional[ProductListItem]:
    if product is None:
        return None
    images = _loaded(product, "images") or []
    inventory = _loaded(product, "inventory")
    primary = images[0].url if images else None
    available = inventory.available_qty if inventory is not None else None
    return ProductListItem(
        id=product.id,
        sku=product.sku,
        name=product.name,
        slug=product.slug,
        short_description=product.short_description,
        individual_price=product.individual_price,
        group_price=product.group_price,
        discount_percentage=product.discount_percentage,
        currency=product.currency,
        group_size=product.group_size,
        is_group_buy_enabled=product.is_group_buy_enabled,
        is_featured=product.is_featured,
        rating_avg=product.rating_avg,
        rating_count=product.rating_count,
        successful_groups_count=product.successful_groups_count,
        units_sold=product.units_sold,
        category_id=product.category_id,
        primary_image_url=primary,
        available_qty=available,
    )


def _group_out(group, include_url: bool = True) -> GroupOut:
    invite_url = None
    if include_url:
        invite_url = f"{settings.cors_origin_list[0]}/groups/{group.id}?invite={group.invite_code}"
    return GroupOut(
        id=group.id,
        product_id=group.product_id,
        creator_id=group.creator_id,
        required_participants=group.required_participants,
        confirmed_participants=group.confirmed_participants,
        pending_participants=group.pending_participants,
        remaining_participants=group.remaining_participants,
        progress_percent=group.progress_percent,
        group_price=group.group_price,
        currency=group.currency,
        status=group.status,
        expires_at=group.expires_at,
        completed_at=group.completed_at,
        invite_code=group.invite_code,
        created_at=group.created_at,
        product=_product_item(getattr(group, "product", None)),
        invite_url=invite_url,
    )


@router.get("", response_model=PaginatedResponse[GroupOut])
async def list_groups(
    db: DbSession,
    category_id: Optional[UUID] = None,
    product_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    service = GroupService(db)
    groups, total = await service.list_open_groups(
        category_id=category_id,
        product_id=product_id,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        items=[_group_out(g) for g in groups],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.post("")
async def create_group(data: GroupCreateRequest, db: DbSession, user: CurrentUser):
    from app.services.order_service import OrderService

    service = GroupService(db)
    group, order = await service.create_group(
        user=user,
        product_id=data.product_id,
        quantity=data.quantity,
        address_id=data.address_id,
        idempotency_key=data.idempotency_key,
        required_participants=data.required_participants,
        promotion_code=data.promotion_code,
    )
    group = await service.get_group(group.id)
    order = await OrderService(db).get_order(order.id)
    return {
        "group": _group_out(group),
        "order": OrderOut.model_validate(order),
    }


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(group_id: UUID, db: DbSession, _: OptionalUser):
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
            user_last_name=(p.user.last_name[0] + ".") if p.user else None,
        )
        for p in group.participants
    ]
    base = _group_out(group)
    return GroupDetail(
        **base.model_dump(),
        participants=participants,
        creator_name=group.creator.full_name if group.creator else None,
    )


@router.post("/{group_id}/join")
async def join_group(
    group_id: UUID, data: GroupJoinRequest, db: DbSession, user: CurrentUser
):
    from app.services.order_service import OrderService

    service = GroupService(db)
    group, order = await service.join_group(
        user=user,
        group_id=group_id,
        quantity=data.quantity,
        address_id=data.address_id,
        idempotency_key=data.idempotency_key,
        invite_token=data.invite_token,
        promotion_code=data.promotion_code,
    )
    group = await service.get_group(group.id)
    order = await OrderService(db).get_order(order.id)
    return {
        "group": _group_out(group),
        "order": OrderOut.model_validate(order),
    }


@router.post("/{group_id}/cancel", response_model=GroupOut)
async def cancel_group(group_id: UUID, db: DbSession, user: CurrentUser):
    service = GroupService(db)
    group = await service.cancel_group(group_id, user)
    group = await service.get_group(group.id)
    return _group_out(group)


@router.get("/{group_id}/participants", response_model=list[ParticipantOut])
async def list_participants(group_id: UUID, db: DbSession, _: CurrentUser):
    service = GroupService(db)
    group = await service.get_group(group_id)
    return [
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
            user_last_name=(p.user.last_name[0] + ".") if p.user else None,
        )
        for p in group.participants
    ]


@router.get("/{group_id}/status", response_model=GroupStatusOut)
async def group_status(group_id: UUID, db: DbSession):
    service = GroupService(db)
    group = await service.get_group(group_id)
    return GroupStatusOut(
        id=group.id,
        status=group.status,
        confirmed_participants=group.confirmed_participants,
        pending_participants=group.pending_participants,
        remaining_participants=group.remaining_participants,
        progress_percent=group.progress_percent,
        expires_at=group.expires_at,
        completed_at=group.completed_at,
    )
