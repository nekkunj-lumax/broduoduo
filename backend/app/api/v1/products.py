"""Product catalog endpoints."""

from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, DbSession, OptionalUser
from app.core.exceptions import NotFoundError
from app.models.inventory import Inventory
from app.models.product import Product, ProductCategory, ProductImage
from app.schemas.common import PaginatedResponse
from app.schemas.product import (
    CategoryCreate,
    CategoryOut,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductUpdate,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(tags=["Products"])


def _to_list_item(product: Product) -> ProductListItem:
    available = product.inventory.available_qty if product.inventory else None
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
        primary_image_url=product.primary_image_url,
        available_qty=available,
    )


@router.get("/products/categories", response_model=list[CategoryOut])
async def list_categories(db: DbSession):
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.is_active.is_(True))
        .order_by(ProductCategory.sort_order, ProductCategory.name)
    )
    return [CategoryOut.model_validate(c) for c in result.scalars().all()]


@router.post("/products/categories", response_model=CategoryOut)
async def create_category(data: CategoryCreate, db: DbSession, _: AdminUser):
    category = ProductCategory(**data.model_dump())
    db.add(category)
    await db.flush()
    return CategoryOut.model_validate(category)


@router.get("/products", response_model=PaginatedResponse[ProductListItem])
async def list_products(
    db: DbSession,
    user: OptionalUser,
    q: Optional[str] = None,
    category_id: Optional[UUID] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    min_discount: Optional[Decimal] = None,
    group_buy_only: bool = False,
    featured: Optional[bool] = None,
    sort: str = Query(default="popular", pattern="^(popular|price_asc|price_desc|newest|discount|rating)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.inventory))
        .where(Product.is_active.is_(True))
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.short_description.ilike(like)))
        analytics = AnalyticsService(db)
        await analytics.track(
            "product_searched",
            user_id=user.id if user else None,
            properties={"q": q},
        )
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if min_price is not None:
        stmt = stmt.where(Product.individual_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.individual_price <= max_price)
    if group_buy_only:
        stmt = stmt.where(Product.is_group_buy_enabled.is_(True))
    if featured is not None:
        stmt = stmt.where(Product.is_featured.is_(featured))

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = await db.scalar(count_stmt) or 0

    if sort == "price_asc":
        stmt = stmt.order_by(Product.group_price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Product.individual_price.desc())
    elif sort == "newest":
        stmt = stmt.order_by(Product.created_at.desc())
    elif sort == "rating":
        stmt = stmt.order_by(Product.rating_avg.desc())
    elif sort == "discount":
        stmt = stmt.order_by(
            ((Product.individual_price - Product.group_price) / Product.individual_price).desc()
        )
    else:
        stmt = stmt.order_by(Product.units_sold.desc(), Product.successful_groups_count.desc())

    result = await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    products = list(result.scalars().unique().all())
    items = [_to_list_item(p) for p in products]
    if min_discount is not None:
        items = [i for i in items if i.discount_percentage >= min_discount]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=ceil(total / page_size) if page_size else 0,
    )


@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(product_id: UUID, db: DbSession, user: OptionalUser):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            selectinload(Product.category),
        )
        .where(Product.id == product_id, Product.is_active.is_(True))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise NotFoundError("Product not found")
    analytics = AnalyticsService(db)
    await analytics.track(
        "product_viewed",
        user_id=user.id if user else None,
        entity_type="product",
        entity_id=product.id,
    )
    detail = ProductDetail(
        **_to_list_item(product).model_dump(),
        description=product.description,
        specifications=product.specifications,
        group_expiration_hours=product.group_expiration_hours,
        max_group_size=product.max_group_size,
        seller_name=product.seller_name,
        shipping_info=product.shipping_info,
        images=product.images,
        inventory=product.inventory,
        created_at=product.created_at,
    )
    return detail


@router.post("/products", response_model=ProductDetail)
async def create_product(data: ProductCreate, db: DbSession, admin: AdminUser):
    product = Product(
        sku=data.sku,
        name=data.name,
        slug=data.slug,
        short_description=data.short_description,
        description=data.description,
        specifications=data.specifications,
        category_id=data.category_id,
        individual_price=data.individual_price,
        group_price=data.group_price,
        group_size=data.group_size,
        group_expiration_hours=data.group_expiration_hours,
        max_group_size=data.max_group_size,
        is_group_buy_enabled=data.is_group_buy_enabled,
        is_featured=data.is_featured,
        seller_name=data.seller_name,
        shipping_info=data.shipping_info,
    )
    db.add(product)
    await db.flush()
    for idx, url in enumerate(data.image_urls):
        db.add(
            ProductImage(
                product_id=product.id,
                url=url,
                alt_text=product.name,
                sort_order=idx,
                is_primary=idx == 0,
            )
        )
    db.add(
        Inventory(
            product_id=product.id,
            available_qty=data.initial_stock,
            reserved_qty=0,
            sold_qty=0,
        )
    )
    await db.flush()
    return await get_product(product.id, db, admin)


@router.put("/products/{product_id}", response_model=ProductDetail)
async def update_product(
    product_id: UUID, data: ProductUpdate, db: DbSession, admin: AdminUser
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise NotFoundError("Product not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    await db.flush()
    return await get_product(product.id, db, admin)


@router.delete("/products/{product_id}")
async def delete_product(product_id: UUID, db: DbSession, _: AdminUser):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise NotFoundError("Product not found")
    product.is_active = False
    await db.flush()
    return {"message": "Product archived"}
