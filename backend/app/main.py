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
from typing import Optional

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
    Drawing,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Holding,
    Position,
    Trade,
    User,
    UserRole,
    Competition,
    CompetitionStatus,
    Participant,
)
from app.schemas import (
    InjectNewsRequest, 
    InjectNewsResponse, 
    MarketStateResponse, 
    ResetSessionResponse,
    SaveDrawingRequest,
    DrawingResponse
)
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

                # House Bot fiat and initial holding
                house_bot.fiat_balance = Decimal("1000000")
                
                # House Bot holding for ORIS
                asset_r = await session.execute(select(Asset).where(Asset.symbol == "ORIS"))
                asset = asset_r.scalar_one_or_none()
                if asset:
                    holding = Holding(
                        user_id=house_bot.id,
                        asset_id=asset.id,
                        quantity=Decimal("1000000")
                    )
                    session.add(holding)

            # Asset: $ORIS — rename legacy "SIM" row if it still exists
            legacy_r = await session.execute(
                select(Asset).where(Asset.symbol == "SIM")
            )
            legacy_asset = legacy_r.scalar_one_or_none()
            if legacy_asset:
                legacy_asset.symbol = "ORIS"
                legacy_asset.name = "Synthex ORIS"
                await session.flush()

            asset_r = await session.execute(
                select(Asset).where(Asset.symbol == "ORIS")
            )
            asset = asset_r.scalar_one_or_none()
            if not asset:
                asset = Asset(symbol="ORIS", name="Synthex ORIS")
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
# Helpers
# ---------------------------------------------------------------------------

async def get_user_portfolio_data(session: AsyncSession, participant_id: uuid.UUID) -> dict:
    part_r = await session.execute(select(Participant).where(Participant.id == participant_id))
    participant = part_r.scalar_one()
    
    holdings_r = await session.execute(
        select(Asset.symbol, Holding.quantity)
        .join(Holding, Holding.asset_id == Asset.id)
        .where(Holding.participant_id == participant_id)
    )
    holdings = {h.symbol: float(h.quantity) for h in holdings_r}

    positions_r = await session.execute(
        select(Asset.symbol, Position.quantity, Position.avg_entry_price)
        .join(Position, Position.asset_id == Asset.id)
        .where(Position.participant_id == participant_id)
    )
    positions = [{
        "symbol": p.symbol,
        "quantity": float(p.quantity),
        "avg_price": float(p.avg_entry_price)
    } for p in positions_r]

    return {
        "fiat_balance": float(participant.current_fiat),
        "holdings": holdings,
        "positions": positions
    }


# ---------------------------------------------------------------------------
# Admin auth dependency
# ---------------------------------------------------------------------------

async def verify_admin_key(x_admin_key: str = Header(None)):
    if not x_admin_key:
        raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ---------------------------------------------------------------------------
# WebSocket Endpoint — /ws/trade/{competition_id}
# ---------------------------------------------------------------------------

@app.websocket("/ws/trade/{competition_id}")
async def ws_trade(websocket: WebSocket, competition_id: uuid.UUID):
    # Accept the raw connection first, then wait for JOIN
    await websocket.accept()
    participant_id: uuid.UUID | None = None

    try:
        # Check if competition exists and is active
        async with async_session() as session:
            comp_r = await session.execute(
                select(Competition).where(Competition.id == competition_id)
            )
            comp = comp_r.scalar_one_or_none()
            if not comp or comp.status != CompetitionStatus.ACTIVE:
                await websocket.send_json({
                    "type": "ERROR",
                    "data": {"message": "Competition not found or not active."},
                })
                await websocket.close()
                return

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

        # Create or find user + participant + portfolio
        async with async_session() as session:
            async with session.begin():
                user_r = await session.execute(
                    select(User).where(User.username == username)
                )
                user = user_r.scalar_one_or_none()

                if not user:
                    user = User(
                        username=username, 
                        role=UserRole.PARTICIPANT,
                    )
                    session.add(user)
                    await session.flush()
                
                # Check if participant exists for this competition
                part_r = await session.execute(
                    select(Participant).where(Participant.user_id == user.id, Participant.competition_id == competition_id)
                )
                participant = part_r.scalar_one_or_none()
                
                if not participant:
                    # Create participant for this competition
                    participant = Participant(
                        user_id=user.id,
                        competition_id=competition_id,
                        current_fiat=comp.starting_balance
                    )
                    session.add(participant)
                    await session.flush()
                    
                    # Create initial ORIS holding for participant
                    asset_r = await session.execute(select(Asset).where(Asset.symbol == "ORIS"))
                    asset = asset_r.scalar_one_or_none()
                    if asset:
                        holding = Holding(participant_id=participant.id, asset_id=asset.id, quantity=Decimal("0"))
                        session.add(holding)

                    logger.info(f"New participant created for room {competition_id}: {username}")

                participant_id = participant.id

        # Register with manager (we already accepted above, so we just manually add to rooms)
        if competition_id not in manager._rooms:
            manager._rooms[competition_id] = {}
        manager._rooms[competition_id][participant_id] = websocket
        logger.info(f"Participant joined room {competition_id}: {username} ({manager.active_count_in_room(competition_id)} total in room)")

        # Send current orderbook snapshot as welcome
        async with async_session() as session:
            ob = await get_orderbook_snapshot(session, competition_id)
            if ob:
                await websocket.send_json(ob)
                
            # Fetch and send user's current fiat and holdings
            port_data = await get_user_portfolio_data(session, participant_id)
            await websocket.send_json({
                "type": "portfolio_update",
                "data": port_data
            })

        # --- Phase 2: Main message loop ---
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type", "")

            if msg_type == "MARKET_ORDER":
                data = raw.get("data", {})
                action = data.get("action", "")
                symbol = data.get("symbol", "ORIS")
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
                                session, competition_id, participant_id, action, symbol, quantity,
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

                # On success: broadcast trade + orderbook_update + leaderboard + portfolio_update
                if result and result.get("status") == "SUCCESS":
                    # Send immediate portfolio update to the user
                    async with async_session() as session:
                        port_data = await get_user_portfolio_data(session, participant_id)
                        await websocket.send_json({
                            "type": "portfolio_update",
                            "data": port_data
                        })
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
                    await manager.broadcast_to_room(competition_id, trade_broadcast)

                    # Broadcast updated orderbook to room
                    async with async_session() as session:
                        ob = await get_orderbook_snapshot(session, competition_id)
                        if ob:
                            await manager.broadcast_to_room(competition_id, ob)

                        # Broadcast leaderboard to room
                        lb = await get_leaderboard(
                            session, competition_id, result["executed_price"], comp.starting_balance,
                        )
                        await manager.broadcast_to_room(competition_id, lb)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(f"WebSocket error for participant {participant_id}")
    finally:
        if participant_id:
            manager.disconnect(competition_id, participant_id)


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

            # Immediate House Bot re-quote for all ACTIVE competitions
            bot_r = await session.execute(
                select(User.id).where(User.role == UserRole.HOUSE_BOT).limit(1)
            )
            house_bot_id = bot_r.scalar_one()

            half_spread = Decimal(str(settings.HALF_SPREAD))
            bot_qty = Decimal(str(settings.HOUSE_BOT_QUANTITY))
            
            active_comps_r = await session.execute(
                select(Competition).where(Competition.status == CompetitionStatus.ACTIVE)
            )
            active_comps = active_comps_r.scalars().all()
            
            best_bid, best_ask = None, None
            
            for comp in active_comps:
                part_r = await session.execute(
                    select(Participant).where(Participant.user_id == house_bot_id, Participant.competition_id == comp.id)
                )
                hb_part = part_r.scalar_one_or_none()
                if hb_part:
                    best_bid, best_ask = await house_bot_requote(
                        session, hb_part.id, comp.id, asset_id, new_fv, half_spread, bot_qty,
                    )
                    ob_payload = {
                        "type": "orderbook_update",
                        "data": {
                            "timestamp": int(time.time() * 1000),
                            "symbol": "ORIS",
                            "best_bid": best_bid,
                            "best_ask": best_ask,
                            "spread": round(best_ask - best_bid, 6),
                            "bid_quantity": settings.HOUSE_BOT_QUANTITY,
                            "ask_quantity": settings.HOUSE_BOT_QUANTITY,
                        },
                    }
                    await manager.broadcast_to_room(comp.id, ob_payload)

    # Broadcast news_alert globally
    await manager.broadcast_global({
        "type": "news_alert",
        "data": {
            "event_id": event_id,
            "headline": req.title,
            "sentiment": req.sentiment,
            "severity": "CRITICAL" if req.sentiment in ("CRASH", "MOON") else "HIGH",
            "duration_seconds": req.duration_seconds,
        },
    })

    return InjectNewsResponse(
        status="success",
        event_id=event_id,
        message="News event injected. House Bot requoted across active competitions. Clients notified.",
        new_fair_value_approx=round(float(new_fv), 2),
        new_best_bid=best_bid or float(new_fv),
        new_best_ask=best_ask or float(new_fv),
    )


@app.get("/api/admin/market-state", response_model=MarketStateResponse)
async def get_market_state(_: None = Depends(verify_admin_key)):
    """Returns internal market state for debugging."""
    async with async_session() as session:
        ms_r = await session.execute(select(MarketState).limit(1))
        ms = ms_r.scalar_one()

        best_bid, best_ask, spread = None, None, None
        
        # Try to get orderbook snapshot for the first active competition
        comp_r = await session.execute(
            select(Competition.id).where(Competition.status == CompetitionStatus.ACTIVE).limit(1)
        )
        comp_id = comp_r.scalar_one_or_none()
        if comp_id:
            ob = await get_orderbook_snapshot(session, comp_id)
            if ob:
                best_bid = ob["data"]["best_bid"]
                best_ask = ob["data"]["best_ask"]
                spread = ob["data"]["spread"]

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
    """Reset all trades, portfolios, orders, participants, competitions, and fair value."""
    async with async_session() as session:
        async with session.begin():
            # Delete data in order of constraints
            await session.execute(delete(Trade))
            await session.execute(delete(Order))
            await session.execute(delete(Holding))
            await session.execute(delete(Position))
            await session.execute(delete(Participant))
            await session.execute(delete(Competition))

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
            # Clear all drawings
            await session.execute(delete(Drawing))

    return ResetSessionResponse(
        status="success",
        message="Session reset. All competitions, participants, and trade data wiped.",
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "synthex", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Drawings API
# ---------------------------------------------------------------------------

@app.get("/api/drawings", response_model=Optional[DrawingResponse])
async def get_drawings(symbol: str, username: str):
    """Retrieve saved drawings for a user and asset."""
    async with async_session() as session:
        user_r = await session.execute(select(User).where(User.username == username))
        user = user_r.scalar_one_or_none()
        if not user:
            return None
        
        asset_r = await session.execute(select(Asset).where(Asset.symbol == symbol))
        asset = asset_r.scalar_one_or_none()
        if not asset:
            return None

        draw_r = await session.execute(
            select(Drawing).where(Drawing.user_id == user.id, Drawing.asset_id == asset.id)
        )
        drawing = draw_r.scalar_one_or_none()
        if not drawing:
            return None
            
        return DrawingResponse(
            symbol=symbol,
            data=drawing.data,
            updated_at=drawing.updated_at.isoformat()
        )


@app.post("/api/drawings")
async def save_drawings(req: SaveDrawingRequest):
    """Save or update chart drawings for a user."""
    async with async_session() as session:
        async with session.begin():
            user_r = await session.execute(select(User).where(User.username == req.username))
            user = user_r.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            asset_r = await session.execute(select(Asset).where(Asset.symbol == req.symbol))
            asset = asset_r.scalar_one_or_none()
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found")

            draw_r = await session.execute(
                select(Drawing).where(Drawing.user_id == user.id, Drawing.asset_id == asset.id).with_for_update()
            )
            drawing = draw_r.scalar_one_or_none()
            
            if drawing:
                drawing.data = req.data
                drawing.updated_at = datetime.now(timezone.utc)
            else:
                drawing = Drawing(user_id=user.id, asset_id=asset.id, data=req.data)
                session.add(drawing)
                
    return {"status": "success"}
