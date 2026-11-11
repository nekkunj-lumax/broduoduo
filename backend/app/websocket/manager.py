"""In-memory WebSocket connection manager."""

from __future__ import annotations

import asyncio
import json
from typing import Any
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.group_rooms: dict[str, set[WebSocket]] = {}
        self.admin_sockets: set[WebSocket] = set()
        self.user_sockets: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect_group(self, group_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        key = str(group_id)
        async with self._lock:
            self.group_rooms.setdefault(key, set()).add(websocket)

    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.admin_sockets.add(websocket)

    async def connect_user(self, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        key = str(user_id)
        async with self._lock:
            self.user_sockets.setdefault(key, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            for room in self.group_rooms.values():
                room.discard(websocket)
            self.admin_sockets.discard(websocket)
            for room in self.user_sockets.values():
                room.discard(websocket)

    async def broadcast_group(self, group_id: UUID, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload})
        sockets = list(self.group_rooms.get(str(group_id), set()))
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                await self.disconnect(ws)

    async def broadcast_admin(self, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload})
        for ws in list(self.admin_sockets):
            try:
                await ws.send_text(message)
            except Exception:
                await self.disconnect(ws)

    async def send_user(self, user_id: UUID, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload})
        for ws in list(self.user_sockets.get(str(user_id), set())):
            try:
                await ws.send_text(message)
            except Exception:
                await self.disconnect(ws)


ws_manager = ConnectionManager()
