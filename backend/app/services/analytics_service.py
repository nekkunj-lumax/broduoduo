"""Analytics event tracking and KPI aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsEvent
from app.models.group import BuyingGroup
from app.models.order import Order, OrderItem, Refund
from app.models.product import Product
from app.models.user import User


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def track(
        self,
        event_name: str,
        user_id: Optional[UUID] = None,
        session_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        properties: Optional[dict[str, Any]] = None,
    ) -> AnalyticsEvent:
        event = AnalyticsEvent(
            event_name=event_name,
            user_id=user_id,
            session_id=session_id,
            entity_type=entity_type,
            entity_id=entity_id,
            properties=properties,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    def _range(
        self, start: Optional[datetime], end: Optional[datetime]
    ) -> tuple[datetime, datetime]:
        end = end or datetime.now(timezone.utc)
        start = start or (end - timedelta(days=30))
        return start, end

    async def overview(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, Any]:
        start, end = self._range(start, end)
        paid_statuses = ("PAID", "PROCESSING", "SHIPPED", "DELIVERED")

        total_customers = await self.db.scalar(select(func.count(User.id))) or 0
        new_customers = await self.db.scalar(
            select(func.count(User.id)).where(
                User.created_at >= start, User.created_at <= end
            )
        ) or 0
        total_products = await self.db.scalar(
            select(func.count(Product.id)).where(Product.is_active.is_(True))
        ) or 0

        orders_q = await self.db.execute(
            select(
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), 0),
            ).where(
                Order.created_at >= start,
                Order.created_at <= end,
                Order.status.in_(paid_statuses),
            )
        )
        paid_orders, paid_value = orders_q.one()
        paid_orders = paid_orders or 0
        paid_value = Decimal(paid_value or 0)

        gmv_q = await self.db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0)).where(
                Order.created_at >= start,
                Order.created_at <= end,
                Order.status.notin_(("CANCELLED",)),
            )
        )
        gmv = Decimal(gmv_q.scalar() or 0)

        refund_amount = Decimal(
            await self.db.scalar(
                select(func.coalesce(func.sum(Refund.amount), 0)).where(
                    Refund.created_at >= start,
                    Refund.created_at <= end,
                    Refund.status == "succeeded",
                )
            )
            or 0
        )
        net_sales = paid_value - refund_amount
        aov = (paid_value / paid_orders) if paid_orders else Decimal("0")

        units_sold = await self.db.scalar(
            select(func.coalesce(func.sum(OrderItem.quantity), 0))
            .select_from(OrderItem)
            .join(Order)
            .where(
                Order.created_at >= start,
                Order.created_at <= end,
                Order.status.in_(paid_statuses),
            )
        ) or 0

        active_groups = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(BuyingGroup.status == "OPEN")
        ) or 0
        successful_groups = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "SUCCESSFUL",
                BuyingGroup.completed_at >= start,
                BuyingGroup.completed_at <= end,
            )
        ) or 0
        expired_groups = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "EXPIRED",
                BuyingGroup.updated_at >= start,
                BuyingGroup.updated_at <= end,
            )
        ) or 0

        terminal_groups = successful_groups + expired_groups
        # Include cancelled in terminal for success rate denominator when in range
        cancelled_groups = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "CANCELLED",
                BuyingGroup.cancelled_at >= start,
                BuyingGroup.cancelled_at <= end,
            )
        ) or 0
        eligible_terminal = successful_groups + expired_groups + cancelled_groups
        group_success_rate = (
            round((successful_groups / eligible_terminal) * 100, 2)
            if eligible_terminal
            else 0.0
        )

        group_checkouts = await self.db.scalar(
            select(func.count(Order.id)).where(
                Order.purchase_type == "group",
                Order.created_at >= start,
                Order.created_at <= end,
            )
        ) or 0
        group_completed_orders = await self.db.scalar(
            select(func.count(Order.id)).where(
                Order.purchase_type == "group",
                Order.status.in_(paid_statuses),
                Order.created_at >= start,
                Order.created_at <= end,
            )
        ) or 0
        group_conversion_rate = (
            round((group_completed_orders / group_checkouts) * 100, 2)
            if group_checkouts
            else 0.0
        )

        active_customers = await self.db.scalar(
            select(func.count(func.distinct(Order.user_id))).where(
                Order.created_at >= start,
                Order.created_at <= end,
                Order.status.in_(paid_statuses),
            )
        ) or 0

        return {
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "total_customers": total_customers,
            "active_customers": active_customers,
            "new_customers": new_customers,
            "total_products": total_products,
            "total_orders": paid_orders,
            "total_units_sold": int(units_sold),
            "active_groups": active_groups,
            "successful_groups": successful_groups,
            "expired_groups": expired_groups,
            "cancelled_groups": cancelled_groups,
            "gmv": float(gmv),
            "paid_order_value": float(paid_value),
            "refund_amount": float(refund_amount),
            "net_sales_revenue": float(net_sales),
            "average_order_value": float(aov.quantize(Decimal("0.01"))),
            "group_success_rate": group_success_rate,
            "group_buying_conversion_rate": group_conversion_rate,
            "formulas": {
                "group_success_rate": "successful / (successful + expired + cancelled) * 100",
                "group_buying_conversion_rate": "paid_group_orders / group_checkout_attempts * 100",
                "average_order_value": "paid_order_value / paid_orders",
                "net_sales_revenue": "paid_order_value - refund_amount",
                "note": "GMV is not profit; it is merchandise value of non-cancelled orders",
            },
        }

    async def revenue_breakdown(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, Any]:
        start, end = self._range(start, end)
        paid_statuses = ("PAID", "PROCESSING", "SHIPPED", "DELIVERED")
        rows = await self.db.execute(
            select(
                Order.purchase_type,
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), 0),
            )
            .where(
                Order.created_at >= start,
                Order.created_at <= end,
                Order.status.in_(paid_statuses),
            )
            .group_by(Order.purchase_type)
        )
        by_type = {
            purchase_type: {"orders": count, "revenue": float(revenue)}
            for purchase_type, count, revenue in rows.all()
        }
        return {"period_start": start.isoformat(), "period_end": end.isoformat(), "by_type": by_type}

    async def group_analytics(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> dict[str, Any]:
        start, end = self._range(start, end)
        created = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.created_at >= start, BuyingGroup.created_at <= end
            )
        ) or 0
        successful = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "SUCCESSFUL",
                BuyingGroup.completed_at >= start,
                BuyingGroup.completed_at <= end,
            )
        ) or 0
        expired = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "EXPIRED",
                BuyingGroup.updated_at >= start,
                BuyingGroup.updated_at <= end,
            )
        ) or 0
        cancelled = await self.db.scalar(
            select(func.count(BuyingGroup.id)).where(
                BuyingGroup.status == "CANCELLED",
                BuyingGroup.cancelled_at >= start,
                BuyingGroup.cancelled_at <= end,
            )
        ) or 0
        terminal = successful + expired + cancelled
        avg_completion = await self.db.scalar(
            select(
                func.avg(
                    func.extract("epoch", BuyingGroup.completed_at - BuyingGroup.created_at)
                )
            ).where(
                BuyingGroup.status == "SUCCESSFUL",
                BuyingGroup.completed_at >= start,
                BuyingGroup.completed_at <= end,
            )
        )
        avg_participants = await self.db.scalar(
            select(func.avg(BuyingGroup.confirmed_participants)).where(
                BuyingGroup.status == "SUCCESSFUL",
                BuyingGroup.completed_at >= start,
                BuyingGroup.completed_at <= end,
            )
        )
        return {
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "groups_created": created,
            "successful_groups": successful,
            "expired_groups": expired,
            "cancelled_groups": cancelled,
            "group_success_rate": round((successful / terminal) * 100, 2) if terminal else 0.0,
            "average_completion_seconds": float(avg_completion or 0),
            "average_participants_per_successful_group": float(avg_participants or 0),
        }

    async def product_sales(
        self,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        start, end = self._range(start, end)
        paid_statuses = ("PAID", "PROCESSING", "SHIPPED", "DELIVERED")
        rows = await self.db.execute(
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.individual_price,
                Product.group_price,
                func.coalesce(
                    func.sum(
                        case(
                            (Order.status.in_(paid_statuses), OrderItem.quantity),
                            else_=0,
                        )
                    ),
                    0,
                ).label("units"),
                func.coalesce(
                    func.sum(
                        case(
                            (Order.status.in_(paid_statuses), OrderItem.line_total),
                            else_=0,
                        )
                    ),
                    0,
                ).label("revenue"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    Order.status.in_(paid_statuses),
                                    Order.purchase_type == "individual",
                                ),
                                OrderItem.quantity,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("individual_units"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    Order.status.in_(paid_statuses),
                                    Order.purchase_type == "group",
                                ),
                                OrderItem.quantity,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("group_units"),
            )
            .select_from(Product)
            .outerjoin(OrderItem, OrderItem.product_id == Product.id)
            .outerjoin(
                Order,
                and_(
                    Order.id == OrderItem.order_id,
                    Order.created_at >= start,
                    Order.created_at <= end,
                ),
            )
            .group_by(Product.id)
            .order_by(func.coalesce(func.sum(OrderItem.line_total), 0).desc())
        )
        return [
            {
                "product_id": str(r.id),
                "name": r.name,
                "sku": r.sku,
                "individual_price": float(r.individual_price),
                "group_price": float(r.group_price),
                "units_sold": int(r.units),
                "revenue": float(r.revenue),
                "individual_units": int(r.individual_units),
                "group_units": int(r.group_units),
            }
            for r in rows.all()
        ]
