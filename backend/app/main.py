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
    CompetitionType,
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

            # Seed Global Sandbox competition
            comp_r = await session.execute(
                select(Competition).where(Competition.name == "Global Sandbox")
            )
            global_comp = comp_r.scalar_one_or_none()
            if not global_comp:
                global_comp = Competition(
                    name="Global Sandbox",
                    type=CompetitionType.PUBLIC,
                    status=CompetitionStatus.ACTIVE,
                    starting_balance=Decimal("100000.00")
                )
                session.add(global_comp)
                await session.flush()

            # Seed 4 Assets
            assets_to_seed = [
                ("SYNX", "Synthex SYNX", Decimal("150.00")),
                ("NEXO", "Synthex NEXO", Decimal("45.50")),
                ("VRTX", "Synthex VRTX", Decimal("210.25")),
                ("AEGS", "Synthex AEGS", Decimal("85.00")),
            ]

            for symbol, name, base_price in assets_to_seed:
                asset_r = await session.execute(
                    select(Asset).where(Asset.symbol == symbol)
                )
                asset = asset_r.scalar_one_or_none()
                if not asset:
                    asset = Asset(symbol=symbol, name=name)
                    session.add(asset)
                    await session.flush()

                # Market state
                ms_r = await session.execute(
                    select(MarketState).where(MarketState.asset_id == asset.id)
                )
                ms = ms_r.scalar_one_or_none()
                if not ms:
                    ms = MarketState(
                        asset_id=asset.id,
                        fair_value=base_price,
                        last_traded_price=base_price,
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
                    
                    # Create initial holdings for participant for all assets
                    assets_r = await session.execute(select(Asset))
                    assets = assets_r.scalars().all()
                    for asset in assets:
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
                symbol = data.get("symbol", "SYNX")
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
# REST API (Competitions)
# ---------------------------------------------------------------------------

@app.get("/api/competitions/active")
async def get_active_competitions():
    """Return a list of all ACTIVE or WAITING public competitions."""
    async with async_session() as session:
        result = await session.execute(
            select(Competition).where(
                Competition.status.in_([CompetitionStatus.WAITING, CompetitionStatus.ACTIVE]),
                Competition.type == CompetitionType.PUBLIC
            )
        )
        comps = result.scalars().all()
        return [
            {
                "id": str(c.id),
                "name": c.name,
                "status": c.status.value,
                "starting_balance": float(c.starting_balance),
                "created_at": c.created_at.isoformat()
            } for c in comps
        ]


# ---------------------------------------------------------------------------
# REST Admin API
# ---------------------------------------------------------------------------

@app.post("/api/admin/competitions/{competition_id}/complete")
async def complete_competition(
    competition_id: uuid.UUID,
    _: None = Depends(verify_admin_key),
):
    """
    Settle all holdings for the competition at closing prices, 
    update PnL, set to COMPLETED, and broadcast final leaderboard.
    """
    async with async_session() as session:
        async with session.begin():
            # Get competition
            comp_r = await session.execute(select(Competition).where(Competition.id == competition_id))
            comp = comp_r.scalar_one_or_none()
            if not comp:
                raise HTTPException(status_code=404, detail="Competition not found")
            
            if comp.status == CompetitionStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Competition already completed")

            # Get market states to find last_traded_price for each asset
            ms_r = await session.execute(
                select(Asset.symbol, MarketState.last_traded_price)
                .join(MarketState, MarketState.asset_id == Asset.id)
            )
            ltp_map = {row.symbol: row.last_traded_price for row in ms_r.all()}

            # Liquidate all participants in this competition
            participants_r = await session.execute(
                select(Participant).where(Participant.competition_id == competition_id)
            )
            participants = participants_r.scalars().all()

            for p in participants:
                # Find holdings
                holdings_r = await session.execute(
                    select(Holding, Asset.symbol)
                    .join(Asset, Asset.id == Holding.asset_id)
                    .where(Holding.participant_id == p.id)
                )
                total_fiat_gain = Decimal("0.00")
                for holding, symbol in holdings_r.all():
                    if holding.quantity > 0:
                        closing_price = ltp_map.get(symbol, Decimal("0.00"))
                        total_fiat_gain += holding.quantity * closing_price
                
                # Update participant fiat and pnl
                p.current_fiat += total_fiat_gain
                p.current_asset = Decimal("0.00")
                p.realized_pnl = p.current_fiat - comp.starting_balance
                
                # Delete holdings
                await session.execute(delete(Holding).where(Holding.participant_id == p.id))

            comp.status = CompetitionStatus.COMPLETED

        # Broadcast the final leaderboard
        lb = await get_leaderboard(async_session, competition_id)
        if competition_id in manager._rooms:
            await manager.broadcast_to_room(
                competition_id, 
                {"type": "leaderboard_update", "data": lb}
            )
            # Notify clients to lock UI and show podium
            await manager.broadcast_to_room(
                competition_id,
                {"type": "competition_completed", "data": {"message": "Competition has ended."}}
            )

        return {"status": "success", "message": f"Competition {competition_id} settled and completed."}



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

            # Apply magnitude to fair value immediately for all assets
            ms_r = await session.execute(select(MarketState, Asset).join(Asset).with_for_update())
            market_states = ms_r.all()
            
            updated_fvs = []
            for ms, asset in market_states:
                new_fv = ms.fair_value * Decimal(str(1 + req.magnitude))
                new_fv = max(new_fv, Decimal("0.01"))
                ms.fair_value = new_fv
                ms.updated_at = now
                updated_fvs.append((asset, new_fv))

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
                    assets_data = []
                    for asset, new_fv in updated_fvs:
                        bb, ba = await house_bot_requote(
                            session, hb_part.id, comp.id, asset.id, new_fv, half_spread, bot_qty,
                        )
                        best_bid, best_ask = bb, ba  # Keep last one for response
                        assets_data.append({
                            "timestamp": int(time.time() * 1000),
                            "symbol": asset.symbol,
                            "best_bid": bb,
                            "best_ask": ba,
                            "spread": round(ba - bb, 6),
                            "bid_quantity": settings.HOUSE_BOT_QUANTITY,
                            "ask_quantity": settings.HOUSE_BOT_QUANTITY,
                        })
                    ob_payload = {
                        "type": "orderbook_update",
                        "data": assets_data,
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
        new_fair_value_approx=round(float(updated_fvs[0][1] if updated_fvs else 0), 2),
        new_best_bid=best_bid or 0.0,
        new_best_ask=best_ask or 0.0,
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

            # Re-seed Global Sandbox
            global_comp = Competition(
                name="Global Sandbox",
                type=CompetitionType.PUBLIC,
                status=CompetitionStatus.ACTIVE,
                starting_balance=Decimal("100000.00")
            )
            session.add(global_comp)
            await session.flush()

            # Reset market state
            assets_to_seed = {
                "SYNX": Decimal("150.00"),
                "NEXO": Decimal("45.50"),
                "VRTX": Decimal("210.25"),
                "AEGS": Decimal("85.00"),
            }
            for symbol, base_price in assets_to_seed.items():
                asset_r = await session.execute(select(Asset).where(Asset.symbol == symbol))
                asset = asset_r.scalar_one_or_none()
                if asset:
                    await session.execute(
                        update(MarketState).where(MarketState.asset_id == asset.id).values(
                            fair_value=base_price,
                            last_traded_price=base_price,
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
