"""
Tick Engine – drives the market simulation.
Every 1 second the loop:
  1. Computes new Fair Values for ALL assets (stochastic process ± news).
  2. Finds every ACTIVE competition.
  3. House Bot re-quotes bid/ask for EACH asset in each competition.
  4. Broadcasts a composite orderbook_update payload to each room.
"""

import asyncio
import logging
import random
import time
from decimal import Decimal
from math import exp

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .config import settings
from .models import (
    Asset,
    Competition,
    CompetitionStatus,
    MarketState,
    NewsEvent,
    Order,
    OrderSide,
    OrderStatus,
    Participant,
    User,
    UserRole,
)
from .connection_manager import ConnectionManager

logger = logging.getLogger("synthex.tick")


# ---------------------------------------------------------------------------
# Fair-value process
# ---------------------------------------------------------------------------

def _calculate_fair_value(
    current_fv: Decimal,
    volatility: float,
    news_magnitude: float | None = None,
) -> Decimal:
    """Mean-reverting random walk for stable price discovery."""
    curr = float(current_fv)
    
    # Parameters for stability
    theta = 0.05  # Speed of mean reversion
    # Target is roughly the initial price (hardcoded or we can fetch, but 100-500 is common)
    # If the price is too high or low, it tends to pull back towards 'reason'
    target = 150.0 
    if curr > 1000: target = 800.0
    if curr < 10:   target = 20.0

    reversion = theta * (target - curr) * 0.01
    
    drift = reversion
    if news_magnitude is not None:
        drift += float(news_magnitude) * 0.005
    
    sigma = volatility * 0.1 # Dampen the volatility constant
    epsilon = random.gauss(0, 1)
    
    # Delta price
    delta = drift + (sigma * curr * epsilon * 0.001)
    new_price = curr + delta
    
    # Floor price to prevent negative or zero
    new_price = max(new_price, 0.0001)
    
    return Decimal(str(round(new_price, 6)))


# ---------------------------------------------------------------------------
# House Bot re-quote
# ---------------------------------------------------------------------------

async def house_bot_requote(
    session: AsyncSession,
    participant_id,
    competition_id,
    asset_id,
    fair_value: Decimal,
    half_spread: Decimal,
    quantity: Decimal,
):
    """Cancel the bot's existing orders for this asset and place fresh bid/ask."""
    await session.execute(
        update(Order)
        .where(
            Order.participant_id == participant_id,
            Order.competition_id == competition_id,
            Order.asset_id == asset_id,
            Order.status == OrderStatus.OPEN,
        )
        .values(status=OrderStatus.CANCELLED)
    )

    raw_bid = fair_value - half_spread * fair_value
    raw_ask = fair_value + half_spread * fair_value
    
    bid_price = max(Decimal("0.01"), round(raw_bid, 2))
    ask_price = max(Decimal("0.01"), round(raw_ask, 2))
    
    # In extreme cases, if they equal due to rounding floor
    if bid_price == ask_price:
        ask_price = bid_price + Decimal("0.01")

    bid_order = Order(
        participant_id=participant_id,
        competition_id=competition_id,
        asset_id=asset_id,
        side=OrderSide.BID,
        price=bid_price,
        quantity=quantity,
    )
    session.add(bid_order)

    ask_order = Order(
        participant_id=participant_id,
        competition_id=competition_id,
        asset_id=asset_id,
        side=OrderSide.ASK,
        price=ask_price,
        quantity=quantity,
    )
    session.add(ask_order)

    await session.flush()
    return float(bid_price), float(ask_price)


def _build_orderbook_payload(best_bid: float, best_ask: float, quantity: int, symbol: str) -> dict:
    """Construct the orderbook_update WebSocket payload per 5-API-Design.md."""
    return {
        "timestamp": int(time.time() * 1000),
        "symbol": symbol,
        "best_bid": best_bid,
        "best_ask": best_ask,
        "spread": round(best_ask - best_bid, 6),
        "bid_quantity": quantity,
        "ask_quantity": quantity,
    }


async def fair_value_tick_loop(
    session_factory: async_sessionmaker,
    manager: ConnectionManager,
):
    """
    The heart of Synthex — runs every 1 second.
    Step 1: Update Fair Value for ALL assets (stochastic or news-overridden).
    Step 2: Find all ACTIVE competitions.
    Step 3: House Bot atomic re-quote per competition per asset and broadcast
            a composite orderbook_update to each room.
    """
    half_spread = Decimal(str(settings.HALF_SPREAD))
    bot_quantity = Decimal(str(settings.HOUSE_BOT_QUANTITY))

    logger.info("Tick loop started — 1 Hz cycle")

    while True:
        try:
            # ----------------------------------------------------------
            # Step 1 — Fair Value computation for ALL assets
            # ----------------------------------------------------------
            asset_fair_values: dict[int, tuple[Decimal, str]] = {}  # asset_id -> (new_fv, symbol)

            async with session_factory() as session:
                async with session.begin():
                    # Fetch all market states with asset info
                    ms_result = await session.execute(
                        select(MarketState, Asset.symbol)
                        .join(Asset, MarketState.asset_id == Asset.id)
                    )
                    market_states = ms_result.all()

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

                    # Resolve house bot id
                    bot_result = await session.execute(
                        select(User.id).where(User.role == UserRole.HOUSE_BOT).limit(1)
                    )
                    house_bot_id = bot_result.scalar_one()

                    # Update fair values for ALL assets
                    for ms_row, symbol in market_states:
                        new_fv = _calculate_fair_value(
                            ms_row.fair_value,
                            settings.VOLATILITY,
                            magnitude,
                        )
                        ms_row.fair_value = new_fv
                        ms_row.updated_at = now
                        asset_fair_values[ms_row.asset_id] = (new_fv, symbol)

            # ----------------------------------------------------------
            # Step 2 & 3 — House Bot re-quote & broadcast per competition
            # ----------------------------------------------------------
            async with session_factory() as session:
                async with session.begin():
                    active_comps_r = await session.execute(
                        select(Competition).where(Competition.status == CompetitionStatus.ACTIVE)
                    )
                    active_comps = active_comps_r.scalars().all()

                    for comp in active_comps:
                        # Ensure House Bot has a participant record for this comp
                        part_r = await session.execute(
                            select(Participant).where(
                                Participant.user_id == house_bot_id,
                                Participant.competition_id == comp.id,
                            )
                        )
                        hb_part = part_r.scalar_one_or_none()
                        if not hb_part:
                            hb_part = Participant(
                                user_id=house_bot_id,
                                competition_id=comp.id,
                                current_fiat=Decimal("1000000"),
                            )
                            session.add(hb_part)
                            await session.flush()

                        # Re-quote and build payload for EACH asset
                        asset_payloads = []
                        for asset_id, (new_fv, symbol) in asset_fair_values.items():
                            best_bid, best_ask = await house_bot_requote(
                                session, hb_part.id, comp.id, asset_id,
                                new_fv, half_spread, bot_quantity,
                            )
                            payload = _build_orderbook_payload(
                                best_bid, best_ask, settings.HOUSE_BOT_QUANTITY, symbol
                            )
                            asset_payloads.append(payload)

                        # Broadcast composite payload to the competition room
                        composite = {
                            "type": "orderbook_update",
                            "data": asset_payloads,
                        }
                        await manager.broadcast_to_room(comp.id, composite)

            logger.debug(f"Tick: {len(asset_fair_values)} assets updated")

        except Exception:
            logger.exception("Tick loop error")

        await asyncio.sleep(1)
