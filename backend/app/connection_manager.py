"""
WebSocket Connection Manager.
Manages all active participant connections and provides broadcast capabilities.
"""

import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Thread-safe manager for active WebSocket connections."""

    def __init__(self):
        self._active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self._active_connections[user_id] = websocket
        logger.info(f"[WS] Connected: {user_id} | Total: {len(self._active_connections)}")

    def disconnect(self, user_id: str):
        self._active_connections.pop(user_id, None)
        logger.info(f"[WS] Disconnected: {user_id} | Total: {len(self._active_connections)}")

    async def send_personal(self, user_id: str, data: dict):
        ws = self._active_connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                self.disconnect(user_id)

    async def broadcast(self, data: dict):
        """Send a JSON payload to every connected client."""
        message = json.dumps(data)
        stale = []
        for user_id, ws in self._active_connections.items():
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(user_id)
        for uid in stale:
            self.disconnect(uid)

    @property
    def active_count(self) -> int:
        return len(self._active_connections)


# Singleton instance shared across the app
manager = ConnectionManager()
