"""
Synthex — FastAPI Application Entry Point.
WebSocket endpoint, Admin REST API, startup seeding, tick loop bootstrap.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.connection_manager import ConnectionManager
from app.database import Base, async_session, engine, get_db
from app.matching_engine import (
    LockContentionError,
    execute_market_order,
    get_leaderboard,
    get_orderbook_snapshot,
)
from app.models import (
    Asset,
    MarketState,
    NewsEvent,
    NewsSentiment,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Portfolio,
    Trade,
    User,
    UserRole,
)
from app.schemas import InjectNewsRequest, InjectNewsResponse, MarketStateResponse, ResetSessionResponse
from app.tick_engine import fair_value_tick_loop, house_bot_requote

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("synthex")

# ---------------------------------------------------------------------------
# App & Middleware
# ---------------------------------------------------------------------------
app = FastAPI(title="Synthex Exchange", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Startup — table creation & seed data
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created.")

    # Seed system data
    async with async_session() as session:
        async with session.begin():
            # House Bot user
            bot_r = await session.execute(
                select(User).where(User.role == UserRole.HOUSE_BOT)
            )
            house_bot = bot_r.scalar_one_or_none()
            if not house_bot:
                house_bot = User(
                    username="__HOUSE_BOT__",
                    role=UserRole.HOUSE_BOT,
                )
                session.add(house_bot)
                await session.flush()

                # House Bot portfolio (effectively infinite)
                bot_portfolio = Portfolio(
                    user_id=house_bot.id,
                    fiat_balance=Decimal("1000000"),
                    asset_quantity=Decimal("1000000"),
                )
                session.add(bot_portfolio)

            # Asset: $SIM
            asset_r = await session.execute(
                select(Asset).where(Asset.symbol == "SIM")
            )
            asset = asset_r.scalar_one_or_none()
            if not asset:
                asset = Asset(symbol="SIM", name="Synthex Coin")
                session.add(asset)
                await session.flush()

            # Market state (single row)
            ms_r = await session.execute(select(MarketState).limit(1))
            ms = ms_r.scalar_one_or_none()
            if not ms:
                ms = MarketState(
                    asset_id=asset.id,
                    fair_value=Decimal(str(settings.INITIAL_FAIR_VALUE)),
                    last_traded_price=Decimal(str(settings.INITIAL_FAIR_VALUE)),
                )
                session.add(ms)

    logger.info("Seed data ready.")

    # Start tick loop as background task
    asyncio.create_task(fair_value_tick_loop(async_session, manager))
    logger.info("Fair Value tick loop launched.")


# ---------------------------------------------------------------------------
# Admin auth dependency
# ---------------------------------------------------------------------------

async def verify_admin_key(x_admin_key: str = Header(None)):
    if not x_admin_key:
        raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ---------------------------------------------------------------------------
# WebSocket Endpoint — /ws/trade
# ---------------------------------------------------------------------------

@app.websocket("/ws/trade")
async def ws_trade(websocket: WebSocket):
    # Accept the raw connection first, then wait for JOIN
    await websocket.accept()
    user_id: uuid.UUID | None = None

    try:
        # --- Phase 1: Wait for JOIN message ---
        raw = await websocket.receive_json()
        msg_type = raw.get("type", "")

        if msg_type != "JOIN":
            await websocket.send_json({
                "type": "ERROR",
                "data": {"message": "First message must be JOIN with a username."},
            })
            await websocket.close()
            return

        username = raw.get("username", "").strip()
        if not username or len(username) > 32:
            await websocket.send_json({
                "type": "ERROR",
                "data": {"message": "Invalid username."},
            })
            await websocket.close()
            return

        # Create or find user + portfolio
        async with async_session() as session:
            async with session.begin():
                user_r = await session.execute(
                    select(User).where(User.username == username)
                )
                user = user_r.scalar_one_or_none()

                if not user:
                    user = User(username=username, role=UserRole.PARTICIPANT)
                    session.add(user)
                    await session.flush()

                    portfolio = Portfolio(
                        user_id=user.id,
                        fiat_balance=Decimal(str(settings.INITIAL_FIAT_BALANCE)),
                        asset_quantity=Decimal("0"),
                    )
                    session.add(portfolio)
                    logger.info(f"New participant created: {username}")

                user_id = user.id

        # Register with manager (re-use the already-accepted websocket)
        manager._connections[user_id] = websocket
        logger.info(f"Participant joined: {username} ({manager.active_count} total)")

        # Send current orderbook snapshot as welcome
        async with async_session() as session:
            ob = await get_orderbook_snapshot(session)
            if ob:
                await websocket.send_json(ob)

        # --- Phase 2: Main message loop ---
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type", "")

            if msg_type == "MARKET_ORDER":
                data = raw.get("data", {})
                action = data.get("action", "")
                symbol = data.get("symbol", "SIM")
                quantity = data.get("quantity", 0)

                # Basic validation
                if action not in ("BUY", "SELL"):
                    await websocket.send_json({
                        "type": "TRADE_RESULT",
                        "data": {"status": "FAILED", "reason": "VALIDATION_ERROR", "message": "action must be BUY or SELL"},
                    })
                    continue
                if not isinstance(quantity, int) or quantity <= 0 or quantity > 500:
                    await websocket.send_json({
                        "type": "TRADE_RESULT",
                        "data": {"status": "FAILED", "reason": "VALIDATION_ERROR", "message": "quantity must be 1-500"},
                    })
                    continue

                # Execute with retry on lock contention
                result = None
                for attempt in range(2):
                    try:
                        async with async_session() as session:
                            result = await execute_market_order(
                                session, user_id, action, symbol, quantity,
                            )
                        break
                    except LockContentionError:
                        if attempt == 0:
                            await asyncio.sleep(0.05)  # 50ms retry per TRD
                        else:
                            result = {
                                "status": "FAILED",
                                "reason": "LOCK_CONTENTION",
                                "message": "Order locked by concurrent operation. Retry.",
                            }

                # Send personal TRADE_RESULT ack
                await websocket.send_json({"type": "TRADE_RESULT", "data": result})

                # On success: broadcast trade + orderbook_update + leaderboard
                if result and result.get("status") == "SUCCESS":
                    trade_broadcast = {
                        "type": "trade",
                        "data": {
                            "timestamp": int(time.time() * 1000),
                            "symbol": symbol,
                            "price": result["executed_price"],
                            "quantity": result["quantity"],
                            "side": action,
                            "trade_id": result["trade_id"],
                        },
                    }
                    await manager.broadcast(trade_broadcast)

                    # Broadcast updated orderbook
                    async with async_session() as session:
                        ob = await get_orderbook_snapshot(session)
                        if ob:
                            await manager.broadcast(ob)

                        # Broadcast leaderboard
                        lb = await get_leaderboard(
                            session, result["executed_price"], settings.INITIAL_FIAT_BALANCE,
                        )
                        await manager.broadcast(lb)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(f"WebSocket error for user {user_id}")
    finally:
        if user_id:
            manager.disconnect(user_id)


# ---------------------------------------------------------------------------
# REST Admin API
# ---------------------------------------------------------------------------

@app.post("/api/admin/inject-news", response_model=InjectNewsResponse)
async def inject_news(
    req: InjectNewsRequest,
    _: None = Depends(verify_admin_key),
):
    """Inject a news event — immediately reprices the House Bot and broadcasts."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=req.duration_seconds)

    async with async_session() as session:
        async with session.begin():
            event = NewsEvent(
                title=req.title,
                sentiment=NewsSentiment(req.sentiment),
                magnitude=req.magnitude,
                duration_seconds=req.duration_seconds,
                is_active=True,
                expires_at=expires,
            )
            session.add(event)
            await session.flush()
            event_id = str(event.id)

            # Apply magnitude to fair value immediately
            ms_r = await session.execute(select(MarketState).limit(1).with_for_update())
            ms = ms_r.scalar_one()
            new_fv = ms.fair_value * Decimal(str(1 + req.magnitude))
            new_fv = max(new_fv, Decimal("0.01"))
            ms.fair_value = new_fv
            ms.updated_at = now
            asset_id = ms.asset_id

            # Immediate House Bot re-quote
            bot_r = await session.execute(
                select(User.id).where(User.role == UserRole.HOUSE_BOT).limit(1)
            )
            house_bot_id = bot_r.scalar_one()

            half_spread = Decimal(str(settings.HALF_SPREAD))
            bot_qty = Decimal(str(settings.HOUSE_BOT_QUANTITY))
            best_bid, best_ask = await house_bot_requote(
                session, house_bot_id, asset_id, new_fv, half_spread, bot_qty,
            )

    # Broadcast news_alert
    await manager.broadcast({
        "type": "news_alert",
        "data": {
            "event_id": event_id,
            "headline": req.title,
            "sentiment": req.sentiment,
            "severity": "CRITICAL" if req.sentiment in ("CRASH", "MOON") else "HIGH",
            "duration_seconds": req.duration_seconds,
        },
    })

    # Broadcast repriced orderbook
    ob_payload = {
        "type": "orderbook_update",
        "data": {
            "timestamp": int(time.time() * 1000),
            "symbol": "SIM",
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": round(best_ask - best_bid, 6),
            "bid_quantity": settings.HOUSE_BOT_QUANTITY,
            "ask_quantity": settings.HOUSE_BOT_QUANTITY,
        },
    }
    await manager.broadcast(ob_payload)

    return InjectNewsResponse(
        status="success",
        event_id=event_id,
        message="News event injected. House Bot requoted. Clients notified.",
        new_fair_value_approx=round(float(new_fv), 2),
        new_best_bid=best_bid,
        new_best_ask=best_ask,
    )


@app.get("/api/admin/market-state", response_model=MarketStateResponse)
async def get_market_state(_: None = Depends(verify_admin_key)):
    """Returns internal market state for debugging."""
    async with async_session() as session:
        ms_r = await session.execute(select(MarketState).limit(1))
        ms = ms_r.scalar_one()

        ob = await get_orderbook_snapshot(session)
        best_bid = ob["data"]["best_bid"] if ob else None
        best_ask = ob["data"]["best_ask"] if ob else None
        spread = ob["data"]["spread"] if ob else None

        # Active news
        now = datetime.now(timezone.utc)
        news_r = await session.execute(
            select(NewsEvent).where(
                NewsEvent.is_active.is_(True), NewsEvent.expires_at > now
            ).limit(1)
        )
        active_news = news_r.scalar_one_or_none()
        news_dict = None
        if active_news:
            news_dict = {
                "title": active_news.title,
                "expires_at": active_news.expires_at.isoformat(),
            }

        trade_count_r = await session.execute(select(func.count(Trade.id)))
        trade_count = trade_count_r.scalar()

    return MarketStateResponse(
        fair_value=round(float(ms.fair_value), 6),
        last_traded_price=round(float(ms.last_traded_price), 6),
        best_bid=best_bid,
        best_ask=best_ask,
        spread=spread,
        active_news_event=news_dict,
        total_trades_this_session=trade_count,
    )


@app.post("/api/admin/reset-session", response_model=ResetSessionResponse)
async def reset_session(_: None = Depends(verify_admin_key)):
    """Reset all trades, portfolios, orders, and fair value."""
    async with async_session() as session:
        async with session.begin():
            # Delete trades
            await session.execute(delete(Trade))
            # Cancel all orders
            await session.execute(
                update(Order).values(status=OrderStatus.CANCELLED)
            )
            # Reset participant portfolios
            await session.execute(
                update(Portfolio)
                .where(
                    Portfolio.user_id.in_(
                        select(User.id).where(User.role == UserRole.PARTICIPANT)
                    )
                )
                .values(
                    fiat_balance=Decimal(str(settings.INITIAL_FIAT_BALANCE)),
                    asset_quantity=Decimal("0"),
                )
            )
            # Reset house bot portfolio
            await session.execute(
                update(Portfolio)
                .where(
                    Portfolio.user_id.in_(
                        select(User.id).where(User.role == UserRole.HOUSE_BOT)
                    )
                )
                .values(
                    fiat_balance=Decimal("1000000"),
                    asset_quantity=Decimal("1000000"),
                )
            )
            # Reset market state
            await session.execute(
                update(MarketState).values(
                    fair_value=Decimal(str(settings.INITIAL_FAIR_VALUE)),
                    last_traded_price=Decimal(str(settings.INITIAL_FAIR_VALUE)),
                    updated_at=datetime.now(timezone.utc),
                )
            )
            # Deactivate all news
            await session.execute(
                update(NewsEvent).values(is_active=False)
            )

    return ResetSessionResponse(
        status="success",
        message=f"Session reset. All portfolios restored to {settings.INITIAL_FIAT_BALANCE:.2f} fiat.",
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "synthex", "version": "2.0.0"}
