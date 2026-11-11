"""Standalone worker loop for scheduled jobs."""

from __future__ import annotations

import asyncio
import logging

from app.workers.tasks import expire_groups_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pindodo.worker")


async def main() -> None:
    logger.info("Worker started")
    while True:
        try:
            count = await expire_groups_job()
            if count:
                logger.info("Expired %s groups", count)
        except Exception:
            logger.exception("Worker tick failed")
        await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(main())
