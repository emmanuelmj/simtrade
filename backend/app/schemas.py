"""
Synthex — Pydantic v2 schemas for all WebSocket messages and REST payloads.
Matches docs/5-API-Design.md contracts exactly.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# WebSocket: Client → Server
# ---------------------------------------------------------------------------

class JoinData(BaseModel):
    username: str = Field(..., min_length=1, max_length=32)


class MarketOrderData(BaseModel):
    action: str = Field(..., pattern="^(BUY|SELL)$")
    symbol: str = Field(default="ORIS")
    quantity: int = Field(..., gt=0, le=500)


class WSMessage(BaseModel):
    type: str
    data: Optional[dict] = None
    username: Optional[str] = None  # For JOIN messages


# ---------------------------------------------------------------------------
# WebSocket: Server → Client
# ---------------------------------------------------------------------------

class TradeEvent(BaseModel):
    type: str = "trade"
    data: dict


class OrderBookUpdate(BaseModel):
    type: str = "orderbook_update"
    data: dict


class TradeResultSuccess(BaseModel):
    type: str = "TRADE_RESULT"
    data: dict


class TradeResultFailed(BaseModel):
    type: str = "TRADE_RESULT"
    data: dict


class NewsAlertWS(BaseModel):
    type: str = "news_alert"
    data: dict


class LeaderboardUpdate(BaseModel):
    type: str = "leaderboard_update"
    data: dict


# ---------------------------------------------------------------------------
# REST: Admin API
# ---------------------------------------------------------------------------

class InjectNewsRequest(BaseModel):
    title: str = Field(..., max_length=120)
    sentiment: str = Field(..., pattern="^(BULLISH|BEARISH|CRASH|MOON)$")
    magnitude: float = Field(..., ge=-0.50, le=0.50)
    duration_seconds: int = Field(..., gt=0, le=600)


class InjectNewsResponse(BaseModel):
    status: str
    event_id: str
    message: str
    new_fair_value_approx: float
    new_best_bid: Optional[float] = None
    new_best_ask: Optional[float] = None


class MarketStateResponse(BaseModel):
    fair_value: float
    last_traded_price: float
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None
    spread: Optional[float] = None
    active_news_event: Optional[dict] = None
    total_trades_this_session: int


class ResetSessionResponse(BaseModel):
    status: str
    message: str
