"""
Synthex — WebSocket Connection Manager.
Maintains connected clients by room and provides broadcast / personal send.
"""

import logging
import uuid
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("synthex.ws")


class ConnectionManager:
    """Manages WebSocket connections keyed by competition_id and then participant_id."""

    def __init__(self):
        # competition_id (UUID) -> { participant_id (UUID): WebSocket }
        self._rooms: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = {}

    async def connect(self, competition_id: uuid.UUID, participant_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        if competition_id not in self._rooms:
            self._rooms[competition_id] = {}
        self._rooms[competition_id][participant_id] = websocket
        logger.info(f"Client connected to room {competition_id}: {participant_id} (Room size: {len(self._rooms[competition_id])})")

    def disconnect(self, competition_id: uuid.UUID, participant_id: uuid.UUID):
        if competition_id in self._rooms:
            self._rooms[competition_id].pop(participant_id, None)
            logger.info(f"Client disconnected from room {competition_id}: {participant_id} (Room size: {len(self._rooms[competition_id])})")
            if not self._rooms[competition_id]:
                del self._rooms[competition_id]

    async def send_personal(self, competition_id: uuid.UUID, participant_id: uuid.UUID, data: dict):
        if competition_id in self._rooms:
            ws = self._rooms[competition_id].get(participant_id)
            if ws:
                try:
                    await ws.send_json(data)
                except Exception:
                    self.disconnect(competition_id, participant_id)

    async def broadcast_to_room(self, competition_id: uuid.UUID, data: dict | Any):
        """Send a JSON message to all clients in a specific room."""
        if competition_id in self._rooms:
            dead: list[uuid.UUID] = []
            for pid, ws in self._rooms[competition_id].items():
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(pid)
            for pid in dead:
                self.disconnect(competition_id, pid)

    async def broadcast_global(self, data: dict | Any):
        """Send a JSON message to all clients across all rooms (e.g. global price tick)."""
        for comp_id in list(self._rooms.keys()):
            await self.broadcast_to_room(comp_id, data)

    def active_count_in_room(self, competition_id: uuid.UUID) -> int:
        return len(self._rooms.get(competition_id, {}))

    @property
    def total_active_count(self) -> int:
        return sum(len(room) for room in self._rooms.values())
