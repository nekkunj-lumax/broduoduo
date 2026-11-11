"""Group-buying schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.product import ProductListItem


class GroupCreateRequest(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=10)
    address_id: UUID
    required_participants: Optional[int] = Field(default=None, ge=2, le=50)
    promotion_code: Optional[str] = None
    idempotency_key: str = Field(min_length=8, max_length=100)


class GroupJoinRequest(BaseModel):
    quantity: int = Field(default=1, ge=1, le=10)
    address_id: UUID
    invite_token: Optional[str] = None
    promotion_code: Optional[str] = None
    idempotency_key: str = Field(min_length=8, max_length=100)


class ParticipantOut(ORMModel):
    id: UUID
    user_id: UUID
    payment_status: str
    quantity: int
    amount: Decimal
    joined_via_invite: bool
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None


class GroupOut(ORMModel):
    id: UUID
    product_id: UUID
    creator_id: UUID
    required_participants: int
    confirmed_participants: int
    pending_participants: int
    remaining_participants: int
    progress_percent: float
    group_price: Decimal
    currency: str
    status: str
    expires_at: datetime
    completed_at: Optional[datetime] = None
    invite_code: str
    created_at: datetime
    product: Optional[ProductListItem] = None
    invite_url: Optional[str] = None


class GroupDetail(GroupOut):
    participants: List[ParticipantOut] = []
    creator_name: Optional[str] = None


class GroupStatusOut(BaseModel):
    id: UUID
    status: str
    confirmed_participants: int
    pending_participants: int
    remaining_participants: int
    progress_percent: float
    expires_at: datetime
    completed_at: Optional[datetime] = None
