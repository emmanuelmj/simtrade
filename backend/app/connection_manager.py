"""
Synthex — WebSocket Connection Manager.
Maintains connected clients and provides broadcast / personal send.
"""

import logging
import uuid
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("synthex.ws")


class ConnectionManager:
    """Manages WebSocket connections keyed by user_id."""

    def __init__(self):
        # user_id (UUID) -> WebSocket
        self._connections: dict[uuid.UUID, WebSocket] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        self._connections[user_id] = websocket
        logger.info(f"Client connected: {user_id} ({len(self._connections)} total)")

    def disconnect(self, user_id: uuid.UUID):
        self._connections.pop(user_id, None)
        logger.info(f"Client disconnected: {user_id} ({len(self._connections)} total)")

    async def send_personal(self, user_id: uuid.UUID, data: dict):
        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(user_id)

    async def broadcast(self, data: dict | Any):
        """Send a JSON message to all connected clients."""
        dead: list[uuid.UUID] = []
        for uid, ws in self._connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(uid)

    @property
    def active_count(self) -> int:
        return len(self._connections)
