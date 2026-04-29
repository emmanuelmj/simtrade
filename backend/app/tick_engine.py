"""
Synthex — AMM Tick Engine.
Implements the 1 Hz Fair Value loop and House Bot re-quote logic.
Ref: docs/3-Architecture.md §2, docs/2-TRD.md §2.3
"""

import asyncio
import logging
import random
import time
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.connection_manager import ConnectionManager
from app.config import settings
from app.models import Asset, MarketState, NewsEvent, Order, OrderSide, OrderStatus, OrderType, User, UserRole

logger = logging.getLogger("synthex.tick")


def _calculate_fair_value(
    current_fv: Decimal,
    volatility: float,
    news_magnitude: float | None,
) -> Decimal:
    """
    Compute next Fair Value.
    Default: random walk  =>  FV + N(0, σ)
    News override:         =>  FV × (1 + magnitude)
    """
    if news_magnitude is not None:
        new_fv = current_fv * Decimal(str(1 + news_magnitude))
    else:
        noise = Decimal(str(random.gauss(0, volatility)))
        new_fv = current_fv + noise

    # Clamp to positive
    return max(new_fv, Decimal("0.01"))


async def house_bot_requote(
    session,
    house_bot_id,
    asset_id,
    fair_value: Decimal,
    half_spread: Decimal,
    quantity: Decimal,
) -> tuple[float, float]:
    """
    Atomic cancel-and-replace per TRD §2.3:
    1. Cancel all open House Bot orders.
    2. Insert new BID at (fair_value - half_spread).
    3. Insert new ASK at (fair_value + half_spread).
    Returns (best_bid, best_ask).
    """
    bid_price = fair_value - half_spread
    ask_price = fair_value + half_spread

    # Clamp bid to positive
    bid_price = max(bid_price, Decimal("0.01"))

    # 1. Cancel existing open orders
    await session.execute(
        update(Order)
        .where(Order.owner_id == house_bot_id, Order.status == OrderStatus.OPEN)
        .values(status=OrderStatus.CANCELLED)
    )

    # 2. Insert new BID
    bid_order = Order(
        owner_id=house_bot_id,
        asset_id=asset_id,
        side=OrderSide.BID,
        order_type=OrderType.LIMIT,
        price=bid_price,
        quantity=quantity,
        status=OrderStatus.OPEN,
    )
    session.add(bid_order)

    # 3. Insert new ASK
    ask_order = Order(
        owner_id=house_bot_id,
        asset_id=asset_id,
        side=OrderSide.ASK,
        order_type=OrderType.LIMIT,
        price=ask_price,
        quantity=quantity,
        status=OrderStatus.OPEN,
    )
    session.add(ask_order)

    await session.flush()
    return float(bid_price), float(ask_price)


def _build_orderbook_payload(best_bid: float, best_ask: float, quantity: int, symbol: str = "SIM") -> dict:
    """Construct the orderbook_update WebSocket payload per 5-API-Design.md."""
    return {
        "type": "orderbook_update",
        "data": {
            "timestamp": int(time.time() * 1000),
            "symbol": symbol,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": round(best_ask - best_bid, 6),
            "bid_quantity": quantity,
            "ask_quantity": quantity,
        },
    }


async def fair_value_tick_loop(
    session_factory: async_sessionmaker,
    manager: ConnectionManager,
):
    """
    The heart of Synthex — runs every 1 second.
    Step 1: Update Fair Value (stochastic or news-overridden).
    Step 2: House Bot atomic re-quote.
    Step 3: Broadcast orderbook_update.
    """
    half_spread = Decimal(str(settings.HALF_SPREAD))
    bot_quantity = Decimal(str(settings.HOUSE_BOT_QUANTITY))

    logger.info("Tick loop started — 1 Hz cycle")

    while True:
        try:
            # ----------------------------------------------------------
            # Step 1 — Fair Value computation (own transaction)
            # ----------------------------------------------------------
            async with session_factory() as session:
                async with session.begin():
                    ms_result = await session.execute(select(MarketState).limit(1))
                    market_state = ms_result.scalar_one()
                    asset_id = market_state.asset_id

                    # Check / expire active news events
                    from datetime import datetime, timezone as tz

                    now = datetime.now(tz.utc)
                    await session.execute(
                        update(NewsEvent)
                        .where(NewsEvent.is_active.is_(True), NewsEvent.expires_at <= now)
                        .values(is_active=False)
                    )

                    news_result = await session.execute(
                        select(NewsEvent).where(
                            NewsEvent.is_active.is_(True),
                            NewsEvent.expires_at > now,
                        ).limit(1)
                    )
                    active_news = news_result.scalar_one_or_none()
                    magnitude = active_news.magnitude if active_news else None

                    new_fv = _calculate_fair_value(
                        market_state.fair_value,
                        settings.VOLATILITY,
                        magnitude,
                    )
                    market_state.fair_value = new_fv
                    market_state.updated_at = now

                    # Resolve house bot id
                    bot_result = await session.execute(
                        select(User.id).where(User.role == UserRole.HOUSE_BOT).limit(1)
                    )
                    house_bot_id = bot_result.scalar_one()

            # ----------------------------------------------------------
            # Step 2 — House Bot re-quote (separate transaction, per TRD)
            # ----------------------------------------------------------
            async with session_factory() as session:
                async with session.begin():
                    best_bid, best_ask = await house_bot_requote(
                        session, house_bot_id, asset_id,
                        new_fv, half_spread, bot_quantity,
                    )

            # ----------------------------------------------------------
            # Step 3 — Broadcast orderbook_update
            # ----------------------------------------------------------
            payload = _build_orderbook_payload(best_bid, best_ask, settings.HOUSE_BOT_QUANTITY)
            await manager.broadcast(payload)

            logger.debug(f"Tick: FV={new_fv:.2f} Bid={best_bid:.2f} Ask={best_ask:.2f}")

        except Exception:
            logger.exception("Tick loop error")

        await asyncio.sleep(1)
