"""
Tick Engine — The heart of simtrade.

Runs an async 1Hz loop that:
1. Checks for active News Events in the DB.
2. Applies Random Walk (Geometric Brownian Motion) with news overrides.
3. Computes leaderboard from all portfolios.
4. Broadcasts MARKET_TICK payload to all WebSocket clients.
"""

import asyncio
import math
import random
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update

from app.database import AsyncSessionLocal, SIM_ASSET_ID
from app.models import NewsEvent, NewsSentiment, Portfolio, User, UserRole
from app.schemas import (
    MarketTickPayload, TickData, LeaderboardEntry, ActiveNewsData, NewsAlertPayload,
)
from app.connection_manager import manager

logger = logging.getLogger(__name__)


# ── Configuration ────────────────────────────────────────────────────────────

INITIAL_PRICE = 100.0
BASE_DRIFT = 0.0001          # Slight upward bias
BASE_VOLATILITY = 0.008      # ~0.8% per tick standard deviation
TICK_INTERVAL = 1.0           # 1 second


# ── Sentiment multipliers for News Events ────────────────────────────────────

SENTIMENT_DRIFT_MAP = {
    NewsSentiment.BULLISH: 1.0,    # Positive drift boost
    NewsSentiment.MOON:    3.0,    # Strong positive drift
    NewsSentiment.BEARISH: -1.0,   # Negative drift
    NewsSentiment.CRASH:   -5.0,   # Severe negative drift
}

SENTIMENT_VOL_MAP = {
    NewsSentiment.BULLISH: 1.5,
    NewsSentiment.MOON:    2.5,
    NewsSentiment.BEARISH: 2.0,
    NewsSentiment.CRASH:   4.0,
}


# ── Tick State ───────────────────────────────────────────────────────────────

class TickState:
    """In-memory state for the current simulation."""

    def __init__(self):
        self.current_price: float = INITIAL_PRICE
        self.tick_count: int = 0
        self.price_history: list[dict] = []
        self.active_news: dict | None = None
        self.is_running: bool = False

    def reset(self):
        self.__init__()


tick_state = TickState()


# ── Price calculation ────────────────────────────────────────────────────────

def calculate_next_price(
    current_price: float,
    drift: float,
    volatility: float,
) -> float:
    """
    Geometric Brownian Motion step:
      S(t+1) = S(t) * exp((drift - 0.5*vol^2) + vol * Z)
    where Z ~ N(0, 1)
    """
    z = random.gauss(0, 1)
    exponent = (drift - 0.5 * volatility ** 2) + volatility * z
    new_price = current_price * math.exp(exponent)
    return round(max(new_price, 0.01), 2)  # Floor at $0.01


# ── Leaderboard computation ─────────────────────────────────────────────────

async def compute_leaderboard(session) -> list[LeaderboardEntry]:
    """Compute leaderboard from all participant portfolios."""
    result = await session.execute(
        select(Portfolio, User)
        .join(User, Portfolio.user_id == User.id)
        .where(User.role == UserRole.PARTICIPANT)
    )
    rows = result.all()

    entries = []
    for portfolio, user in rows:
        fiat = float(portfolio.fiat_balance)
        unrealized = float(portfolio.asset_quantity) * tick_state.current_price
        total_value = round(fiat + unrealized, 2)
        entries.append(LeaderboardEntry(
            username=user.username,
            total_value=total_value,
            rank=0,
        ))

    # Sort descending by total value and assign ranks
    entries.sort(key=lambda e: e.total_value, reverse=True)
    for i, entry in enumerate(entries):
        entry.rank = i + 1

    return entries


# ── News Event processing ───────────────────────────────────────────────────

async def process_news_events(session) -> tuple[float, float, dict | None]:
    """
    Check DB for active news events. Apply drift/volatility overrides.
    Expire events past their expires_at timestamp.
    Returns (effective_drift, effective_volatility, active_news_data).
    """
    now = datetime.now(timezone.utc)
    drift = BASE_DRIFT
    volatility = BASE_VOLATILITY
    active_news_data = None

    # Expire old events
    await session.execute(
        update(NewsEvent)
        .where(NewsEvent.is_active == True, NewsEvent.expires_at <= now)
        .values(is_active=False)
    )

    # Fetch currently active events
    result = await session.execute(
        select(NewsEvent).where(NewsEvent.is_active == True)
    )
    active_events = result.scalars().all()

    if active_events:
        # Use the most recent active event for display, but stack all effects
        for event in active_events:
            drift_mult = SENTIMENT_DRIFT_MAP.get(event.sentiment, 0)
            vol_mult = SENTIMENT_VOL_MAP.get(event.sentiment, 1)
            drift += BASE_DRIFT * drift_mult * event.magnitude
            volatility *= vol_mult

        latest = active_events[-1]
        active_news_data = {
            "headline": latest.title,
            "sentiment": latest.sentiment.value,
            "severity": "HIGH" if latest.magnitude >= 3 else "MEDIUM" if latest.magnitude >= 1.5 else "LOW",
        }

    await session.commit()
    return drift, volatility, active_news_data


# ── The main tick loop ───────────────────────────────────────────────────────

async def run_tick_loop():
    """
    The 1Hz game loop. Runs forever as a background asyncio task.
    """
    tick_state.is_running = True
    logger.info(f"[TICK] Engine started | Price: ${tick_state.current_price:.2f}")

    while tick_state.is_running:
        loop_start = time.monotonic()

        try:
            async with AsyncSessionLocal() as session:
                # Step 1 + 2: Check news events & compute adjusted drift/vol
                drift, volatility, active_news_data = await process_news_events(session)

                # Step 3: Calculate new price
                tick_state.current_price = calculate_next_price(
                    tick_state.current_price, drift, volatility
                )
                tick_state.tick_count += 1

                # Store active news in state for other components
                tick_state.active_news = active_news_data

                # Step 4: Compute leaderboard
                leaderboard = await compute_leaderboard(session)

                # Step 5: Build and broadcast payload
                tick_data = TickData(
                    timestamp=time.time(),
                    symbol="SIM",
                    price=tick_state.current_price,
                    volume=random.randint(100, 5000),
                )

                payload = MarketTickPayload(
                    data=tick_data,
                    leaderboard=leaderboard,
                    active_news=ActiveNewsData(**active_news_data) if active_news_data else None,
                )

                await manager.broadcast(payload.model_dump())

                logger.info(
                    f"[TICK #{tick_state.tick_count}] "
                    f"${tick_state.current_price:.2f} | "
                    f"Clients: {manager.active_count} | "
                    f"News: {'YES' if active_news_data else 'none'}"
                )

        except Exception as e:
            logger.error(f"[TICK] Error: {e}", exc_info=True)

        # Maintain precise 1-second interval
        elapsed = time.monotonic() - loop_start
        sleep_time = max(0, TICK_INTERVAL - elapsed)
        await asyncio.sleep(sleep_time)
