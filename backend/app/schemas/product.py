"""Product schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CategoryOut(ORMModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int
    is_active: bool


class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0


class ProductImageOut(ORMModel):
    id: UUID
    url: str
    alt_text: Optional[str] = None
    sort_order: int
    is_primary: bool


class InventoryOut(ORMModel):
    available_qty: int
    reserved_qty: int
    sold_qty: int
    low_stock_threshold: int
    is_low_stock: bool = False


class ProductListItem(ORMModel):
    id: UUID
    sku: str
    name: str
    slug: str
    short_description: str
    individual_price: Decimal
    group_price: Decimal
    discount_percentage: Decimal
    currency: str
    group_size: int
    is_group_buy_enabled: bool
    is_featured: bool
    rating_avg: Decimal
    rating_count: int
    successful_groups_count: int
    units_sold: int
    category_id: UUID
    primary_image_url: Optional[str] = None
    available_qty: Optional[int] = None


class ProductDetail(ProductListItem):
    description: str
    specifications: Optional[str] = None
    group_expiration_hours: int
    max_group_size: int
    seller_name: str
    shipping_info: str
    images: List[ProductImageOut] = []
    inventory: Optional[InventoryOut] = None
    created_at: datetime


class ProductCreate(BaseModel):
    sku: str
    name: str
    slug: str
    short_description: str
    description: str
    specifications: Optional[str] = None
    category_id: UUID
    individual_price: Decimal = Field(gt=0)
    group_price: Decimal = Field(gt=0)
    group_size: int = Field(ge=2, le=50, default=3)
    group_expiration_hours: int = Field(ge=1, le=168, default=24)
    max_group_size: int = Field(ge=2, le=50, default=10)
    is_group_buy_enabled: bool = True
    is_featured: bool = False
    initial_stock: int = Field(ge=0, default=100)
    image_urls: List[str] = []
    seller_name: str = "Brodoudou Official"
    shipping_info: str = "Ships within 2-5 business days"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    specifications: Optional[str] = None
    category_id: Optional[UUID] = None
    individual_price: Optional[Decimal] = None
    group_price: Optional[Decimal] = None
    group_size: Optional[int] = None
    group_expiration_hours: Optional[int] = None
    max_group_size: Optional[int] = None
    is_group_buy_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    seller_name: Optional[str] = None
    shipping_info: Optional[str] = None


class ReviewOut(ORMModel):
    id: UUID
    product_id: UUID
    user_id: UUID
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None
    is_verified_purchase: bool
    created_at: datetime


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = None
    body: Optional[str] = None
