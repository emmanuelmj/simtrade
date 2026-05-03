"""
Synthex — Order Matching Engine.
Implements SELECT ... FOR UPDATE NOWAIT locking per TRD §2.2.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Asset,
    MarketState,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Holding,
    Position,
    Trade,
    User,
    UserRole,
)

logger = logging.getLogger("synthex.match")


class LockContentionError(Exception):
    """Raised when SELECT FOR UPDATE NOWAIT fails due to a concurrent lock."""
    pass


async def execute_market_order(
    session: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    symbol: str,
    quantity: int,
) -> dict:
    """
    Execute a human Market Order against the House Bot's standing Limit Orders.
    All operations are atomic within a single DB transaction.

    Returns a dict suitable for sending as a TRADE_RESULT WebSocket message.
    """
    qty_dec = Decimal(str(quantity))

    try:
        async with session.begin():
            # 1. Resolve asset
            asset_r = await session.execute(select(Asset).where(Asset.symbol == symbol))
            asset = asset_r.scalar_one_or_none()
            if not asset:
                return _fail("VALIDATION_ERROR", f"Unknown symbol: {symbol}")

            # 2. Find best matching Limit Order with row-level lock (NOWAIT)
            if action == "BUY":
                order_q = (
                    select(Order)
                    .where(
                        Order.asset_id == asset.id,
                        Order.side == OrderSide.ASK,
                        Order.status == OrderStatus.OPEN,
                        Order.order_type == OrderType.LIMIT,
                    )
                    .order_by(Order.price.asc())
                    .limit(1)
                    .with_for_update(nowait=True)
                )
            else:
                order_q = (
                    select(Order)
                    .where(
                        Order.asset_id == asset.id,
                        Order.side == OrderSide.BID,
                        Order.status == OrderStatus.OPEN,
                        Order.order_type == OrderType.LIMIT,
                    )
                    .order_by(Order.price.desc())
                    .limit(1)
                    .with_for_update(nowait=True)
                )

            order_r = await session.execute(order_q)
            matched_order = order_r.scalar_one_or_none()

            if not matched_order:
                return _fail("NO_LIQUIDITY", "No liquidity available. Try again next tick.")

            # Check sufficient quantity on the order
            if matched_order.quantity < qty_dec:
                return _fail("NO_LIQUIDITY", f"Insufficient order depth. Available: {matched_order.quantity}")

            execution_price = matched_order.price
            total_cost = execution_price * qty_dec

            # 3. Lock participant data (User, Holding, Position)
            user_r = await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
            user = user_r.scalar_one_or_none()
            if not user:
                return _fail("VALIDATION_ERROR", "User not found.")

            holding_r = await session.execute(
                select(Holding).where(Holding.user_id == user_id, Holding.asset_id == asset.id).with_for_update()
            )
            holding = holding_r.scalar_one_or_none()
            if not holding:
                holding = Holding(user_id=user_id, asset_id=asset.id, quantity=Decimal("0"))
                session.add(holding)

            position_r = await session.execute(
                select(Position).where(Position.user_id == user_id, Position.asset_id == asset.id).with_for_update()
            )
            position = position_r.scalar_one_or_none()
            if not position:
                position = Position(user_id=user_id, asset_id=asset.id, quantity=Decimal("0"), avg_entry_price=Decimal("0"))
                session.add(position)

            if action == "BUY" and user.fiat_balance < total_cost:
                return _fail(
                    "INSUFFICIENT_FUNDS",
                    f"Insufficient fiat balance. Required: {total_cost}, Available: {user.fiat_balance}",
                )
            if action == "SELL" and holding.quantity < qty_dec:
                return _fail(
                    "INSUFFICIENT_INVENTORY",
                    f"Insufficient inventory. Required: {quantity}, Available: {holding.quantity}",
                )

            # 4. Lock House Bot data
            bot_r = await session.execute(
                select(User).where(User.role == UserRole.HOUSE_BOT).limit(1).with_for_update()
            )
            house_bot = bot_r.scalar_one()

            hholding_r = await session.execute(
                select(Holding).where(Holding.user_id == house_bot.id, Holding.asset_id == asset.id).with_for_update()
            )
            house_holding = hholding_r.scalar_one_or_none()
            if not house_holding:
                house_holding = Holding(user_id=house_bot.id, asset_id=asset.id, quantity=Decimal("1000000"))
                session.add(house_holding)

            # 5. Atomic balance adjustments
            now = datetime.now(timezone.utc)

            if action == "BUY":
                buyer_id, seller_id = user_id, house_bot.id
                user.fiat_balance -= total_cost
                holding.quantity += qty_dec
                
                # Update Position avg entry price
                new_total_qty = position.quantity + qty_dec
                if new_total_qty > 0:
                    position.avg_entry_price = (
                        (position.quantity * position.avg_entry_price) + total_cost
                    ) / new_total_qty
                position.quantity += qty_dec
                
                house_bot.fiat_balance += total_cost
                house_holding.quantity -= qty_dec
            else:
                buyer_id, seller_id = house_bot.id, user_id
                user.fiat_balance += total_cost
                holding.quantity -= qty_dec
                
                # Update Position quantity (avg price remains same on SELL usually, or we close part of it)
                position.quantity -= qty_dec
                # If quantity hits zero, reset avg price
                if position.quantity <= 0:
                    position.avg_entry_price = Decimal("0")
                
                house_bot.fiat_balance -= total_cost
                house_holding.quantity += qty_dec

            # 6. Update matched order (deduct quantity; FILL if depleted)
            matched_order.quantity -= qty_dec
            if matched_order.quantity <= 0:
                matched_order.status = OrderStatus.FILLED
                matched_order.filled_at = now

            # 7. Insert immutable trade record
            trade = Trade(
                asset_id=asset.id,
                buyer_id=buyer_id,
                seller_id=seller_id,
                matched_order_id=matched_order.id,
                price=execution_price,
                quantity=qty_dec,
                total_value=total_cost,
            )
            session.add(trade)

            # 8. Update LTP in market_state
            ms_r = await session.execute(
                select(MarketState).where(MarketState.asset_id == asset.id).with_for_update()
            )
            ms = ms_r.scalar_one()
            ms.last_traded_price = execution_price
            ms.updated_at = now

            await session.flush()

            return {
                "status": "SUCCESS",
                "trade_id": str(trade.id),
                "action": action,
                "executed_price": float(execution_price),
                "quantity": quantity,
                "total_cost": float(total_cost),
                "new_fiat_balance": float(user.fiat_balance),
                "new_asset_quantity": float(holding.quantity),
                "message": f"{'Bought' if action == 'BUY' else 'Sold'} {quantity} ORIS at {execution_price}",
            }

    except OperationalError as e:
        if "could not obtain lock" in str(e).lower():
            raise LockContentionError("Order locked by concurrent operation.")
        raise


async def get_orderbook_snapshot(session: AsyncSession, symbol: str = "ORIS") -> dict | None:
    """Read current best bid/ask from the CLOB."""
    asset_r = await session.execute(select(Asset).where(Asset.symbol == symbol))
    asset = asset_r.scalar_one_or_none()
    if not asset:
        return None

    bid_r = await session.execute(
        select(Order.price, Order.quantity)
        .where(
            Order.asset_id == asset.id,
            Order.side == OrderSide.BID,
            Order.status == OrderStatus.OPEN,
        )
        .order_by(Order.price.desc())
        .limit(1)
    )
    bid_row = bid_r.first()

    ask_r = await session.execute(
        select(Order.price, Order.quantity)
        .where(
            Order.asset_id == asset.id,
            Order.side == OrderSide.ASK,
            Order.status == OrderStatus.OPEN,
        )
        .order_by(Order.price.asc())
        .limit(1)
    )
    ask_row = ask_r.first()

    best_bid = float(bid_row[0]) if bid_row else None
    best_ask = float(ask_row[0]) if ask_row else None
    bid_qty = float(bid_row[1]) if bid_row else 0
    ask_qty = float(ask_row[1]) if ask_row else 0

    spread = round(best_ask - best_bid, 6) if (best_bid and best_ask) else None

    return {
        "type": "orderbook_update",
        "data": {
            "timestamp": int(time.time() * 1000),
            "symbol": symbol,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "bid_quantity": bid_qty,
            "ask_quantity": ask_qty,
        },
    }


async def get_leaderboard(session: AsyncSession, ltp: float, initial_fiat: float) -> dict:
    """Compute leaderboard sorted by total portfolio value."""
    result = await session.execute(
        select(User.username, User.fiat_balance, func.sum(Holding.quantity))
        .join(Holding, Holding.user_id == User.id, isouter=True)
        .where(User.role == UserRole.PARTICIPANT)
        .group_by(User.id, User.username, User.fiat_balance)
    )
    rows = result.all()

    rankings = []
    for username, fiat, asset_qty in rows:
        total_value = float(fiat) + float(asset_qty) * ltp
        pnl = total_value - initial_fiat
        pnl_pct = round((pnl / initial_fiat) * 100, 2) if initial_fiat > 0 else 0
        rankings.append({
            "username": username,
            "total_value": round(total_value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": pnl_pct,
        })

    rankings.sort(key=lambda r: r["total_value"], reverse=True)
    for i, r in enumerate(rankings):
        r["rank"] = i + 1

    return {
        "type": "leaderboard_update",
        "data": {
            "rankings": rankings,
            "ltp_used": ltp,
        },
    }


def _fail(reason: str, message: str) -> dict:
    return {"status": "FAILED", "reason": reason, "message": message}
