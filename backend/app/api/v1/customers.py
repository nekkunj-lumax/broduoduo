"""Customer profile and account endpoints."""

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import NotFoundError
from app.models.group import BuyingGroup, GroupParticipant
from app.models.notification import Notification
from app.models.user import User, UserAddress
from app.schemas.auth import UserOut
from app.schemas.common import PaginatedResponse
from app.schemas.group import GroupOut
from app.schemas.order import OrderOut
from app.services.group_service import GroupService
from app.services.notification_service import NotificationService
from app.services.order_service import OrderService
from app.api.v1.groups import _group_out

router = APIRouter(prefix="/customers", tags=["Customer"])


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class AddressCreate(BaseModel):
    label: str = "Home"
    recipient_name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "US"
    is_default: bool = False


class AddressOut(BaseModel):
    id: UUID
    label: str
    recipient_name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool

    model_config = {"from_attributes": True}


@router.get("/profile", response_model=UserOut)
async def get_profile(user: CurrentUser):
    return UserOut.model_validate(user)


@router.put("/profile", response_model=UserOut)
async def update_profile(data: ProfileUpdate, db: DbSession, user: CurrentUser):
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await db.flush()
    return UserOut.model_validate(user)


@router.get("/orders", response_model=PaginatedResponse[OrderOut])
async def customer_orders(
    db: DbSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    service = OrderService(db)
    orders, total = await service.list_orders(
        user_id=user.id, page=page, page_size=page_size
    )
    return PaginatedResponse(
        items=[OrderOut.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/groups", response_model=list[GroupOut])
async def customer_groups(
    db: DbSession,
    user: CurrentUser,
    status: Optional[str] = None,
):
    from app.models.product import Product

    stmt = (
        select(BuyingGroup)
        .join(GroupParticipant, GroupParticipant.group_id == BuyingGroup.id)
        .options(
            selectinload(BuyingGroup.product).selectinload(Product.images),
            selectinload(BuyingGroup.product).selectinload(Product.inventory),
        )
        .where(GroupParticipant.user_id == user.id)
        .order_by(BuyingGroup.created_at.desc())
    )
    if status:
        stmt = stmt.where(BuyingGroup.status == status)
    result = await db.execute(stmt)
    groups = list(result.scalars().unique().all())
    return [_group_out(g) for g in groups]


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(db: DbSession, user: CurrentUser):
    result = await db.execute(
        select(UserAddress).where(UserAddress.user_id == user.id)
    )
    return [AddressOut.model_validate(a) for a in result.scalars().all()]


@router.post("/addresses", response_model=AddressOut)
async def create_address(data: AddressCreate, db: DbSession, user: CurrentUser):
    if data.is_default:
        existing = await db.execute(
            select(UserAddress).where(UserAddress.user_id == user.id)
        )
        for addr in existing.scalars().all():
            addr.is_default = False
    address = UserAddress(user_id=user.id, **data.model_dump())
    db.add(address)
    await db.flush()
    return AddressOut.model_validate(address)


@router.get("/notifications")
async def list_notifications(db: DbSession, user: CurrentUser, unread_only: bool = False):
    service = NotificationService(db)
    notes = await service.list_for_user(user.id, unread_only=unread_only)
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "body": n.body,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
            "reference_type": n.reference_type,
            "reference_id": str(n.reference_id) if n.reference_id else None,
        }
        for n in notes
    ]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID, db: DbSession, user: CurrentUser
):
    service = NotificationService(db)
    await service.mark_read(user.id, notification_id)
    return {"message": "ok"}
