"""Pytest fixtures for API and service tests."""

from __future__ import annotations

import secrets
from collections.abc import AsyncGenerator
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.inventory import Inventory
from app.models.product import Product, ProductCategory, ProductImage
from app.models.user import Role, User, UserAddress


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def sample_product(db: AsyncSession) -> Product:
    cat = (await db.execute(select(ProductCategory).limit(1))).scalar_one_or_none()
    if cat is None:
        cat = ProductCategory(name="Test Cat", slug=f"test-{secrets.token_hex(3)}")
        db.add(cat)
        await db.flush()
    product = Product(
        sku=f"T-{secrets.token_hex(4)}",
        name="Test Headphones",
        slug=f"test-headphones-{secrets.token_hex(3)}",
        short_description="Test product",
        description="Detailed description",
        category_id=cat.id,
        individual_price=Decimal("50.00"),
        group_price=Decimal("35.00"),
        group_size=3,
        group_expiration_hours=24,
        max_group_size=10,
        is_group_buy_enabled=True,
        is_active=True,
    )
    db.add(product)
    await db.flush()
    db.add(
        ProductImage(
            product_id=product.id,
            url="https://picsum.photos/200",
            is_primary=True,
        )
    )
    db.add(Inventory(product_id=product.id, available_qty=100, reserved_qty=0, sold_qty=0))
    await db.commit()
    await db.refresh(product)
    return product
