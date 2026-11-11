"""Scheduled background tasks for group expiration and notifications."""

from __future__ import annotations

import logging

from app.core.database import AsyncSessionLocal
from app.services.group_service import GroupService
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


async def expire_groups_job() -> int:
    async with AsyncSessionLocal() as session:
        try:
            service = GroupService(session)
            count = await service.expire_due_groups()
            await session.commit()
            if count:
                await ws_manager.broadcast_admin(
                    "groups_expired",
                    {"count": count},
                )
                logger.info("Expired %s groups", count)
            return count
        except Exception:
            await session.rollback()
            logger.exception("Failed to expire groups")
            raise
