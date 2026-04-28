"""
WebSocket route for participant trading.

Endpoint: ws://localhost:8000/ws/trade
- Accepts WebSocket upgrade with a user_id query parameter.
- Pushes MARKET_TICK updates (handled by tick_engine broadcast).
- Listens for TRADE_EXECUTE messages and processes Buy/Sell against House.
"""

import json
import logging
from decimal import Decimal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connection_manager import manager
from app.database import AsyncSessionLocal, SIM_ASSET_ID
from app.models import Portfolio, Transaction, TradeType, User
from app.schemas import TradeExecutePayload, TradeResultPayload, TradeResultData
from app.tick_engine import tick_state

logger = logging.getLogger(__name__)
router = APIRouter()


async def execute_trade(user_id: str, action: str, quantity: int) -> TradeResultData:
    """
    Execute a trade against the House at the current tick price.
    Uses atomic balance checks to prevent race conditions.
    """
    price = Decimal(str(tick_state.current_price))
    total_cost = price * quantity

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Find the user's portfolio for $SIM
            result = await session.execute(
                select(Portfolio).where(
                    Portfolio.user_id == user_id,
                    Portfolio.asset_id == SIM_ASSET_ID,
                )
            )
            portfolio = result.scalar_one_or_none()

            if not portfolio:
                return TradeResultData(
                    status="FAILED",
                    message="Portfolio not found. Are you registered?",
                )

            if action == "BUY":
                if portfolio.fiat_balance < total_cost:
                    return TradeResultData(
                        status="FAILED",
                        message=f"Insufficient funds. Need ${total_cost:.2f}, have ${portfolio.fiat_balance:.2f}",
                    )
                portfolio.fiat_balance -= total_cost
                portfolio.asset_quantity += quantity

            elif action == "SELL":
                if portfolio.asset_quantity < quantity:
                    return TradeResultData(
                        status="FAILED",
                        message=f"Insufficient shares. Need {quantity}, have {portfolio.asset_quantity}",
                    )
                portfolio.fiat_balance += total_cost
                portfolio.asset_quantity -= quantity

            # Append to immutable ledger
            transaction = Transaction(
                user_id=user_id,
                asset_id=SIM_ASSET_ID,
                type=TradeType.BUY if action == "BUY" else TradeType.SELL,
                quantity=quantity,
                price_per_unit=price,
                total_cost=total_cost,
            )
            session.add(transaction)

            return TradeResultData(
                status="SUCCESS",
                executed_price=float(price),
                total_cost=float(total_cost),
                new_fiat_balance=float(portfolio.fiat_balance),
                new_asset_quantity=float(portfolio.asset_quantity),
                message=f"Successfully {'bought' if action == 'BUY' else 'sold'} {quantity} SIM @ ${price:.2f}",
            )


@router.websocket("/ws/trade")
async def websocket_trade(websocket: WebSocket):
    """
    Main WebSocket endpoint for participants.
    Query param: ?user_id=<uuid>
    """
    user_id = websocket.query_params.get("user_id")
    if not user_id:
        # Generate an anonymous session ID for spectators
        user_id = str(uuid.uuid4())

    await manager.connect(user_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                if data.get("type") == "TRADE_EXECUTE":
                    payload = TradeExecutePayload(**data)
                    result = await execute_trade(
                        user_id=user_id,
                        action=payload.data.action,
                        quantity=payload.data.quantity,
                    )
                    response = TradeResultPayload(data=result)
                    await manager.send_personal(user_id, response.model_dump())
                else:
                    await manager.send_personal(user_id, {
                        "type": "ERROR",
                        "message": f"Unknown message type: {data.get('type')}",
                    })
            except json.JSONDecodeError:
                await manager.send_personal(user_id, {
                    "type": "ERROR",
                    "message": "Invalid JSON payload",
                })
            except Exception as e:
                logger.error(f"[WS] Trade error for {user_id}: {e}", exc_info=True)
                await manager.send_personal(user_id, {
                    "type": "ERROR",
                    "message": str(e),
                })
    except WebSocketDisconnect:
        manager.disconnect(user_id)
