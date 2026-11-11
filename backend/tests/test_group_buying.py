"""Group-buying lifecycle tests."""

from __future__ import annotations

import secrets
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.user import Role, User, UserAddress
from app.services.group_service import GroupService
from app.services.payment_service import PaymentService


async def _make_user(db: AsyncSession, email: str) -> User:
    role = (await db.execute(select(Role).where(Role.name == "customer"))).scalar_one_or_none()
    if role is None:
        role = Role(name="customer", description="Customer")
        db.add(role)
        await db.flush()
    user = User(
        email=email,
        password_hash=hash_password("Customer123!"),
        first_name="G",
        last_name="Buyer",
        referral_code=secrets.token_urlsafe(6).upper()[:10],
        is_active=True,
    )
    user.roles.append(role)
    db.add(user)
    await db.flush()
    db.add(
        UserAddress(
            user_id=user.id,
            label="Home",
            recipient_name="G Buyer",
            phone="+15550001111",
            line1="10 Group Ave",
            city="Austin",
            state="TX",
            postal_code="78701",
            country="US",
            is_default=True,
        )
    )
    await db.commit()
    await db.refresh(user)
    return user


async def _address_id(db: AsyncSession, user_id) -> str:
    addr = (
        await db.execute(select(UserAddress).where(UserAddress.user_id == user_id))
    ).scalar_one()
    return str(addr.id)


@pytest.mark.asyncio
async def test_group_completion_requires_paid_participants(
    db: AsyncSession, sample_product: Product
):
    users = [
        await _make_user(db, f"g{i}_{secrets.token_hex(3)}@example.com") for i in range(3)
    ]
    service = GroupService(db)
    payment = PaymentService(db)

    creator = users[0]
    addr = await _address_id(db, creator.id)
    group, order = await service.create_group(
        user=creator,
        product_id=sample_product.id,
        quantity=1,
        address_id=__import__("uuid").UUID(addr),
        idempotency_key=f"idem-create-{secrets.token_hex(4)}",
        required_participants=3,
    )
    await payment.create_payment(
        order_id=order.id,
        idempotency_key=f"pay-{secrets.token_hex(4)}",
        user_id=creator.id,
    )
    await db.refresh(group)
    assert group.status == "OPEN"
    assert group.confirmed_participants == 1

    for user in users[1:]:
        addr = await _address_id(db, user.id)
        group, order = await service.join_group(
            user=user,
            group_id=group.id,
            quantity=1,
            address_id=__import__("uuid").UUID(addr),
            idempotency_key=f"idem-join-{secrets.token_hex(4)}",
        )
        # Joining alone must not count as confirmed
        await db.refresh(group)
        assert group.status == "OPEN"
        await payment.create_payment(
            order_id=order.id,
            idempotency_key=f"pay-{secrets.token_hex(4)}",
            user_id=user.id,
        )

    group = await service.get_group(group.id)
    assert group.status == "SUCCESSFUL"
    assert group.confirmed_participants == 3


@pytest.mark.asyncio
async def test_duplicate_participation_blocked(db: AsyncSession, sample_product: Product):
    user = await _make_user(db, f"dup_{secrets.token_hex(3)}@example.com")
    service = GroupService(db)
    payment = PaymentService(db)
    addr = await _address_id(db, user.id)
    group, order = await service.create_group(
        user=user,
        product_id=sample_product.id,
        quantity=1,
        address_id=__import__("uuid").UUID(addr),
        idempotency_key=f"idem-{secrets.token_hex(4)}",
        required_participants=3,
    )
    await payment.create_payment(
        order_id=order.id,
        idempotency_key=f"pay-{secrets.token_hex(4)}",
        user_id=user.id,
    )
    with pytest.raises(Exception):
        await service.join_group(
            user=user,
            group_id=group.id,
            quantity=1,
            address_id=__import__("uuid").UUID(addr),
            idempotency_key=f"idem-{secrets.token_hex(4)}",
        )


@pytest.mark.asyncio
async def test_inventory_reservation_on_group_create(db: AsyncSession, sample_product: Product):
    user = await _make_user(db, f"inv_{secrets.token_hex(3)}@example.com")
    before = (
        await db.execute(select(Inventory).where(Inventory.product_id == sample_product.id))
    ).scalar_one()
    available_before = before.available_qty
    service = GroupService(db)
    addr = await _address_id(db, user.id)
    await service.create_group(
        user=user,
        product_id=sample_product.id,
        quantity=2,
        address_id=__import__("uuid").UUID(addr),
        idempotency_key=f"idem-{secrets.token_hex(4)}",
    )
    await db.refresh(before)
    assert before.available_qty == available_before - 2
    assert before.reserved_qty >= 2


@pytest.mark.asyncio
async def test_products_list_api(client: AsyncClient):
    resp = await client.get("/api/products")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_admin_analytics_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/analytics/overview")
    assert resp.status_code == 401
