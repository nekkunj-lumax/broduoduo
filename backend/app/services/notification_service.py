"""Notification creation and fan-out helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def notify_user(
        self,
        user_id: UUID,
        title: str,
        body: str,
        notification_type: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        self.db.add(notification)
        await self.db.flush()
        return notification

    async def notify_many(
        self,
        user_ids: list[UUID],
        title: str,
        body: str,
        notification_type: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
    ) -> None:
        for user_id in user_ids:
            await self.notify_user(
                user_id, title, body, notification_type, reference_type, reference_id
            )

    async def list_for_user(self, user_id: UUID, unread_only: bool = False) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_read(self, user_id: UUID, notification_id: UUID) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
