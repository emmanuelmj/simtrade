"""
Pydantic schemas for all API and WebSocket contracts.
Maps directly to the payloads defined in 5-API-Design.md.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── WebSocket: Server → Client ───────────────────────────────────────────────

class TickData(BaseModel):
    timestamp: float
    symbol: str = "SIM"
    price: float
    volume: int = 0


class LeaderboardEntry(BaseModel):
    username: str
    total_value: float
    rank: int


class ActiveNewsData(BaseModel):
    headline: str
    sentiment: str
    severity: str = "HIGH"


class MarketTickPayload(BaseModel):
    type: Literal["MARKET_TICK"] = "MARKET_TICK"
    data: TickData
    leaderboard: list[LeaderboardEntry] = []
    active_news: Optional[ActiveNewsData] = None


class NewsAlertPayload(BaseModel):
    type: Literal["NEWS_ALERT"] = "NEWS_ALERT"
    data: ActiveNewsData


# ── WebSocket: Client → Server ───────────────────────────────────────────────

class TradeExecuteData(BaseModel):
    action: Literal["BUY", "SELL"]
    symbol: str = "SIM"
    quantity: int = Field(gt=0, le=1000, description="Number of shares to trade")


class TradeExecutePayload(BaseModel):
    type: Literal["TRADE_EXECUTE"] = "TRADE_EXECUTE"
    data: TradeExecuteData


class TradeResultData(BaseModel):
    status: Literal["SUCCESS", "FAILED"]
    executed_price: float = 0
    total_cost: float = 0
    new_fiat_balance: float = 0
    new_asset_quantity: float = 0
    message: str = ""


class TradeResultPayload(BaseModel):
    type: Literal["TRADE_RESULT"] = "TRADE_RESULT"
    data: TradeResultData


# ── REST: Admin God Mode ─────────────────────────────────────────────────────

class NewsInjectRequest(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    sentiment: Literal["BULLISH", "BEARISH", "CRASH", "MOON"]
    magnitude: float = Field(gt=0, le=10.0, default=1.0)
    duration_seconds: int = Field(gt=0, le=300, default=30)


class NewsInjectResponse(BaseModel):
    status: str = "success"
    message: str = "Event injected. Tick loop updated."
