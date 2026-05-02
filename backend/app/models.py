"""
Synthex — SQLAlchemy ORM models.
Exact 1:1 mapping to the schema defined in docs/3-Architecture.md.
All financial fields use NUMERIC(18,6) for exact decimal arithmetic.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    PARTICIPANT = "PARTICIPANT"
    ADMIN = "ADMIN"
    HOUSE_BOT = "HOUSE_BOT"


class OrderSide(str, enum.Enum):
    BID = "BID"
    ASK = "ASK"


class OrderType(str, enum.Enum):
    LIMIT = "LIMIT"
    MARKET = "MARKET"


class OrderStatus(str, enum.Enum):
    OPEN = "OPEN"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"


class NewsSentiment(str, enum.Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    CRASH = "CRASH"
    MOON = "MOON"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(64), unique=True, nullable=False)
    role = Column(Enum(UserRole, name="user_role", create_constraint=True), nullable=False, default=UserRole.PARTICIPANT)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(16), unique=True, nullable=False)
    name = Column(String(128), nullable=False)


class MarketState(Base):
    """Single-row table holding the hidden Fair Value oracle and LTP."""
    __tablename__ = "market_state"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    fair_value = Column(Numeric(18, 6), nullable=False)
    last_traded_price = Column(Numeric(18, 6), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Order(Base):
    """Central Limit Order Book (CLOB) — stores House Bot limit orders."""
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_orders_quantity_positive"),
        CheckConstraint("price IS NULL OR price > 0", name="ck_orders_price_positive"),
        Index("ix_orders_book_lookup", "asset_id", "side", "status", "price"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    side = Column(Enum(OrderSide, name="order_side", create_constraint=True), nullable=False)
    order_type = Column(Enum(OrderType, name="order_type", create_constraint=True), nullable=False, default=OrderType.LIMIT)
    price = Column(Numeric(18, 6), nullable=True)  # NULL for MARKET orders
    quantity = Column(Numeric(18, 6), nullable=False)
    status = Column(Enum(OrderStatus, name="order_status", create_constraint=True), nullable=False, default=OrderStatus.OPEN)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    filled_at = Column(DateTime(timezone=True), nullable=True)


class Trade(Base):
    """Immutable execution ledger. Append-only — no UPDATE or DELETE."""
    __tablename__ = "trades"
    __table_args__ = (
        Index("ix_trades_lookup", "asset_id", "executed_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    matched_order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    price = Column(Numeric(18, 6), nullable=False)
    quantity = Column(Numeric(18, 6), nullable=False)
    total_value = Column(Numeric(18, 6), nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Portfolio(Base):
    __tablename__ = "portfolios"
    __table_args__ = (
        CheckConstraint("fiat_balance >= 0", name="ck_portfolios_fiat_nonneg"),
        CheckConstraint("asset_quantity >= 0", name="ck_portfolios_asset_nonneg"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    fiat_balance = Column(Numeric(18, 6), nullable=False, default=0)
    asset_quantity = Column(Numeric(18, 6), nullable=False, default=0)


class NewsEvent(Base):
    __tablename__ = "news_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(120), nullable=False)
    sentiment = Column(Enum(NewsSentiment, name="news_sentiment", create_constraint=True), nullable=False)
    magnitude = Column(Float, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
