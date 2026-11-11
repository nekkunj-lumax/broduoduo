"""Brodoudou FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.workers.tasks import expire_groups_job
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


async def _expiration_loop() -> None:
    while True:
        try:
            await expire_groups_job()
        except Exception:
            logger.exception("Expiration worker error")
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_expiration_loop())
    logger.info("Brodoudou backend started (%s)", settings.app_env)
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="Social commerce and group-buying platform API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name, "version": __version__}


@app.websocket("/ws/groups/{group_id}")
async def ws_group(websocket: WebSocket, group_id: UUID):
    await ws_manager.connect_group(group_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)


@app.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket):
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)


@app.websocket("/ws/users/{user_id}")
async def ws_user(websocket: WebSocket, user_id: UUID):
    await ws_manager.connect_user(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
