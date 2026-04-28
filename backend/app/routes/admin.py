"""
Admin "God Mode" REST API routes.
Provides scenario injection endpoints for the Game Master.
"""

import os
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import NewsEvent, NewsSentiment
from app.schemas import NewsInjectRequest, NewsInjectResponse, NewsAlertPayload, ActiveNewsData
from app.connection_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "synthex-god-mode-secret")


async def verify_admin(x_api_key: str = Header(default="")):
    """Simple API key verification for God Mode access."""
    if x_api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Access denied. Invalid admin key.")


@router.post("/inject-news", response_model=NewsInjectResponse, dependencies=[Depends(verify_admin)])
async def inject_news(
    request: NewsInjectRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Inject a News Event into the simulation.
    The tick engine will pick it up on the next tick cycle.
    Also immediately broadcasts a NEWS_ALERT to all connected clients.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=request.duration_seconds)

    event = NewsEvent(
        title=request.title,
        sentiment=NewsSentiment(request.sentiment),
        magnitude=request.magnitude,
        duration_seconds=request.duration_seconds,
        is_active=True,
        created_at=now,
        expires_at=expires_at,
    )

    session.add(event)
    await session.commit()

    # Immediately broadcast NEWS_ALERT to all clients
    alert = NewsAlertPayload(
        data=ActiveNewsData(
            headline=request.title,
            sentiment=request.sentiment,
            severity="HIGH" if request.magnitude >= 3 else "MEDIUM" if request.magnitude >= 1.5 else "LOW",
        )
    )
    await manager.broadcast(alert.model_dump())

    logger.info(f"[ADMIN] News injected: '{request.title}' | Sentiment: {request.sentiment} | Magnitude: {request.magnitude} | Duration: {request.duration_seconds}s")

    return NewsInjectResponse(
        status="success",
        message=f"Event injected. '{request.title}' active for {request.duration_seconds}s.",
    )


@router.get("/status")
async def admin_status():
    """Quick status check for the admin panel."""
    from app.tick_engine import tick_state
    return {
        "tick_count": tick_state.tick_count,
        "current_price": tick_state.current_price,
        "connected_clients": manager.active_count,
        "active_news": tick_state.active_news,
        "engine_running": tick_state.is_running,
    }
