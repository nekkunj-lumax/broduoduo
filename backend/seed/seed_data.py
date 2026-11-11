"""Seed realistic development data for Brodoudou."""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.models import *  # noqa: F401,F403
from app.models.group import BuyingGroup, GroupInvitation, GroupParticipant
from app.models.inventory import Inventory
from app.models.order import Order, OrderItem, Payment, Refund
from app.models.product import Product, ProductCategory, ProductImage
from app.models.user import Role, User, UserAddress

CATEGORIES = [
    ("Electronics", "electronics", "Phones, audio, gadgets"),
    ("Fashion", "fashion", "Apparel and accessories"),
    ("Home and Kitchen", "home-kitchen", "Home essentials"),
    ("Grocery", "grocery", "Everyday pantry items"),
    ("Beauty and Personal Care", "beauty", "Skincare and beauty"),
    ("Sports and Outdoor", "sports-outdoor", "Fitness and outdoors"),
    ("Accessories", "accessories", "Bags, wallets, tech accessories"),
    ("Toys and Games", "toys-games", "Kids and family fun"),
]

PRODUCTS = [
    ("Wireless Bluetooth Headphones", "electronics", 79.99, 49.99, 3, True),
    ("USB-C Fast Charger 65W", "electronics", 39.99, 24.99, 2, True),
    ("Smart LED Desk Lamp", "electronics", 45.00, 29.00, 3, False),
    ("Noise Cancelling Earbuds", "electronics", 129.00, 79.00, 5, True),
    ("Portable Power Bank 20000mAh", "electronics", 49.99, 32.99, 3, True),
    ("Casual Cotton T-Shirt", "fashion", 24.99, 14.99, 3, True),
    ("Slim Fit Denim Jeans", "fashion", 59.99, 39.99, 3, False),
    ("Lightweight Running Jacket", "fashion", 89.00, 55.00, 5, True),
    ("Knit Beanie Hat", "fashion", 18.00, 11.00, 2, False),
    ("Canvas Sneakers", "fashion", 64.00, 42.00, 3, True),
    ("Nonstick Frying Pan Set", "home-kitchen", 54.99, 34.99, 3, True),
    ("Electric Kettle 1.7L", "home-kitchen", 39.99, 25.99, 2, True),
    ("Memory Foam Pillow", "home-kitchen", 29.99, 18.99, 3, False),
    ("Stainless Steel Water Bottle", "home-kitchen", 22.00, 13.50, 2, True),
    ("Ceramic Dinner Plate Set", "home-kitchen", 48.00, 31.00, 5, False),
    ("Organic Green Tea 50ct", "grocery", 16.99, 11.99, 3, False),
    ("Gourmet Coffee Beans 1lb", "grocery", 21.00, 14.50, 2, True),
    ("Trail Mix Variety Pack", "grocery", 18.50, 12.00, 3, False),
    ("Honey Almond Granola", "grocery", 12.99, 8.99, 2, False),
    ("Vitamin C Gummies", "grocery", 19.99, 12.99, 3, True),
    ("Hydrating Face Serum", "beauty", 34.00, 22.00, 3, True),
    ("SPF 50 Sunscreen Lotion", "beauty", 18.00, 11.50, 2, False),
    ("Matte Lip Color Set", "beauty", 28.00, 17.00, 3, True),
    ("Bamboo Hairbrush", "beauty", 15.00, 9.50, 2, False),
    ("Yoga Mat Premium", "sports-outdoor", 42.00, 27.00, 3, True),
    ("Resistance Band Set", "sports-outdoor", 24.00, 15.00, 2, True),
    ("Insulated Hiking Flask", "sports-outdoor", 32.00, 21.00, 3, False),
    ("Adjustable Dumbbell Pair", "sports-outdoor", 99.00, 69.00, 5, True),
    ("Leather Card Wallet", "accessories", 29.00, 18.00, 2, True),
    ("Crossbody Sling Bag", "accessories", 45.00, 28.00, 3, True),
    ("Phone Case MagSafe", "accessories", 26.00, 16.00, 2, False),
    ("Building Blocks Adventure Set", "toys-games", 39.99, 24.99, 3, True),
    ("Strategy Board Game Night", "toys-games", 34.00, 22.00, 5, True),
    ("Remote Control Race Car", "toys-games", 49.00, 31.00, 3, True),
    ("Plush Stuffed Animal Bear", "toys-games", 22.00, 13.00, 2, False),
]


def _slug(name: str) -> str:
    return (
        name.lower()
        .replace("&", "and")
        .replace(" ", "-")
        .replace("/", "-")
        .replace("'", "")
    )


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).limit(1))
        if existing:
            print("Seed skipped: database already has users")
            return

        roles = {
            "customer": Role(name="customer", description="Customer"),
            "staff": Role(name="staff", description="Staff"),
            "admin": Role(name="admin", description="Administrator"),
            "owner": Role(name="owner", description="Business owner"),
        }
        for role in roles.values():
            db.add(role)
        await db.flush()

        admins = [
            ("admin@pindodo.com", "Admin", "Owner", "owner", "Admin123!"),
            ("manager@pindodo.com", "Maya", "Manager", "admin", "Admin123!"),
            ("staff@pindodo.com", "Sam", "Staff", "staff", "Staff123!"),
        ]
        admin_users = []
        for email, first, last, role_name, password in admins:
            user = User(
                email=email,
                password_hash=hash_password(password),
                first_name=first,
                last_name=last,
                referral_code=secrets.token_urlsafe(6).upper()[:10],
                is_active=True,
                is_email_verified=True,
            )
            user.roles.append(roles[role_name])
            db.add(user)
            admin_users.append(user)
        await db.flush()

        customers = []
        for i in range(1, 21):
            user = User(
                email=f"customer{i}@example.com",
                password_hash=hash_password("Customer123!"),
                first_name=f"Customer{i}",
                last_name="Shopper",
                phone=f"+1555000{i:04d}",
                referral_code=f"REF{i:04d}{secrets.token_hex(2).upper()}",
                is_active=True,
                is_email_verified=True,
            )
            user.roles.append(roles["customer"])
            db.add(user)
            customers.append(user)
        await db.flush()

        for user in customers:
            db.add(
                UserAddress(
                    user_id=user.id,
                    label="Home",
                    recipient_name=user.full_name,
                    phone=user.phone or "+15550000000",
                    line1=f"{100 + customers.index(user)} Market Street",
                    city="Austin",
                    state="TX",
                    postal_code="78701",
                    country="US",
                    is_default=True,
                )
            )
        await db.flush()

        category_map = {}
        for idx, (name, slug, desc) in enumerate(CATEGORIES):
            cat = ProductCategory(
                name=name,
                slug=slug,
                description=desc,
                sort_order=idx,
                image_url=f"https://picsum.photos/seed/{slug}/400/300",
            )
            db.add(cat)
            category_map[slug] = cat
        await db.flush()

        products = []
        for idx, (name, cat_slug, ind, grp, gsize, featured) in enumerate(PRODUCTS):
            product = Product(
                sku=f"SKU-{idx+1:04d}",
                name=name,
                slug=_slug(name) + f"-{idx+1}",
                short_description=f"Great deal on {name}. Perfect for group buying.",
                description=(
                    f"{name} is a top-rated Brodoudou pick. Buy alone or save more when "
                    f"you team up with friends through group buying."
                ),
                specifications="Material: Premium quality\nWarranty: 1 year\nOrigin: Global",
                category_id=category_map[cat_slug].id,
                individual_price=Decimal(str(ind)),
                group_price=Decimal(str(grp)),
                group_size=gsize,
                group_expiration_hours=24,
                max_group_size=max(10, gsize),
                is_group_buy_enabled=True,
                is_featured=featured,
                rating_avg=Decimal(str(round(3.8 + (idx % 12) * 0.1, 2))),
                rating_count=10 + idx * 3,
                seller_name="Brodoudou Official",
            )
            db.add(product)
            await db.flush()
            for img_i in range(3):
                db.add(
                    ProductImage(
                        product_id=product.id,
                        url=f"https://picsum.photos/seed/{product.slug}-{img_i}/800/800",
                        alt_text=name,
                        sort_order=img_i,
                        is_primary=img_i == 0,
                    )
                )
            db.add(
                Inventory(
                    product_id=product.id,
                    available_qty=80 + (idx * 3) % 40,
                    reserved_qty=0,
                    sold_qty=idx * 2,
                    low_stock_threshold=10,
                )
            )
            products.append(product)
        await db.flush()

        now = datetime.now(timezone.utc)

        # Active open groups (near completion prioritized)
        open_groups = []
        for i, product in enumerate(products[:8]):
            creator = customers[i]
            group = BuyingGroup(
                product_id=product.id,
                creator_id=creator.id,
                required_participants=product.group_size,
                confirmed_participants=max(0, product.group_size - 1 - (i % 2)),
                pending_participants=1 if i % 3 == 0 else 0,
                group_price=product.group_price,
                currency="USD",
                status="OPEN",
                expires_at=now + timedelta(hours=6 + i),
                invite_code=secrets.token_urlsafe(8)[:12],
            )
            db.add(group)
            await db.flush()
            db.add(
                GroupInvitation(
                    group_id=group.id,
                    created_by_id=creator.id,
                    invite_token=secrets.token_urlsafe(16),
                    expires_at=group.expires_at,
                )
            )
            for p_i in range(group.confirmed_participants):
                participant_user = customers[(i + p_i) % len(customers)]
                order = Order(
                    order_number=f"PDSEED{secrets.token_hex(3).upper()}",
                    user_id=participant_user.id,
                    purchase_type="group",
                    buying_group_id=group.id,
                    status="PAID",
                    subtotal=product.group_price,
                    discount_amount=Decimal("0"),
                    shipping_amount=Decimal("0"),
                    tax_amount=(product.group_price * Decimal("0.08")).quantize(Decimal("0.01")),
                    total_amount=(product.group_price * Decimal("1.08")).quantize(Decimal("0.01")),
                    currency="USD",
                    shipping_address_snapshot='{"city":"Austin","state":"TX"}',
                    paid_at=now - timedelta(hours=2),
                )
                db.add(order)
                await db.flush()
                db.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        product_name=product.name,
                        product_sku=product.sku,
                        unit_price=product.group_price,
                        quantity=1,
                        line_total=product.group_price,
                        purchase_type="group",
                    )
                )
                db.add(
                    Payment(
                        order_id=order.id,
                        provider="simulated",
                        provider_payment_id=f"sim_seed_{secrets.token_hex(6)}",
                        amount=order.total_amount,
                        currency="USD",
                        status="succeeded",
                        idempotency_key=f"seed-pay-{order.order_number}",
                        confirmed_at=order.paid_at,
                    )
                )
                db.add(
                    GroupParticipant(
                        group_id=group.id,
                        user_id=participant_user.id,
                        order_id=order.id,
                        payment_status="paid",
                        quantity=1,
                        amount=order.total_amount,
                        confirmed_at=order.paid_at,
                    )
                )
            open_groups.append(group)

        # Successful groups
        for i in range(5):
            product = products[8 + i]
            creator = customers[i + 5]
            group = BuyingGroup(
                product_id=product.id,
                creator_id=creator.id,
                required_participants=product.group_size,
                confirmed_participants=product.group_size,
                pending_participants=0,
                group_price=product.group_price,
                currency="USD",
                status="SUCCESSFUL",
                expires_at=now - timedelta(hours=1),
                completed_at=now - timedelta(hours=2),
                invite_code=secrets.token_urlsafe(8)[:12],
            )
            db.add(group)
            product.successful_groups_count += 1
            await db.flush()
            for p_i in range(product.group_size):
                u = customers[(i + p_i + 2) % len(customers)]
                order = Order(
                    order_number=f"PDSUC{secrets.token_hex(3).upper()}",
                    user_id=u.id,
                    purchase_type="group",
                    buying_group_id=group.id,
                    status="PROCESSING",
                    subtotal=product.group_price,
                    discount_amount=Decimal("0"),
                    shipping_amount=Decimal("0"),
                    tax_amount=Decimal("0"),
                    total_amount=product.group_price,
                    currency="USD",
                    shipping_address_snapshot='{"city":"Austin"}',
                    paid_at=now - timedelta(hours=5),
                )
                db.add(order)
                await db.flush()
                db.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        product_name=product.name,
                        product_sku=product.sku,
                        unit_price=product.group_price,
                        quantity=1,
                        line_total=product.group_price,
                        purchase_type="group",
                    )
                )
                db.add(
                    GroupParticipant(
                        group_id=group.id,
                        user_id=u.id,
                        order_id=order.id,
                        payment_status="paid",
                        quantity=1,
                        amount=order.total_amount,
                        confirmed_at=order.paid_at,
                    )
                )

        # Expired + cancelled
        for status, offset in (("EXPIRED", 15), ("CANCELLED", 16)):
            product = products[offset]
            group = BuyingGroup(
                product_id=product.id,
                creator_id=customers[0].id,
                required_participants=3,
                confirmed_participants=1 if status == "EXPIRED" else 0,
                pending_participants=0,
                group_price=product.group_price,
                currency="USD",
                status=status,
                expires_at=now - timedelta(hours=3),
                cancelled_at=now - timedelta(hours=2) if status == "CANCELLED" else None,
                invite_code=secrets.token_urlsafe(8)[:12],
            )
            db.add(group)

        # Individual orders + refund sample
        for i in range(8):
            product = products[i + 10]
            user = customers[i]
            order = Order(
                order_number=f"PDIND{secrets.token_hex(3).upper()}",
                user_id=user.id,
                purchase_type="individual",
                status="DELIVERED" if i < 6 else "REFUNDED",
                subtotal=product.individual_price,
                discount_amount=Decimal("0"),
                shipping_amount=Decimal("4.99"),
                tax_amount=(product.individual_price * Decimal("0.08")).quantize(Decimal("0.01")),
                total_amount=(
                    product.individual_price
                    + Decimal("4.99")
                    + (product.individual_price * Decimal("0.08")).quantize(Decimal("0.01"))
                ),
                currency="USD",
                shipping_address_snapshot='{"city":"Austin"}',
                paid_at=now - timedelta(days=i + 1),
            )
            db.add(order)
            await db.flush()
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    product_sku=product.sku,
                    unit_price=product.individual_price,
                    quantity=1,
                    line_total=product.individual_price,
                    purchase_type="individual",
                )
            )
            payment = Payment(
                order_id=order.id,
                provider="simulated",
                provider_payment_id=f"sim_ind_{secrets.token_hex(6)}",
                amount=order.total_amount,
                currency="USD",
                status="succeeded",
                idempotency_key=f"seed-ind-{order.order_number}",
                confirmed_at=order.paid_at,
            )
            db.add(payment)
            await db.flush()
            if order.status == "REFUNDED":
                db.add(
                    Refund(
                        order_id=order.id,
                        payment_id=payment.id,
                        amount=order.total_amount,
                        currency="USD",
                        reason="Customer requested refund",
                        status="succeeded",
                        provider_refund_id=f"re_{secrets.token_hex(5)}",
                        processed_at=now - timedelta(hours=6),
                    )
                )

        await db.commit()
        print("Seed completed successfully")
        print("Admin: admin@pindodo.com / Admin123!")
        print("Manager: manager@pindodo.com / Admin123!")
        print("Staff: staff@pindodo.com / Staff123!")
        print("Customers: customer1@example.com .. customer20@example.com / Customer123!")


if __name__ == "__main__":
    asyncio.run(seed())
