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
    JSON,
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


class CompetitionStatus(str, enum.Enum):
    WAITING = "WAITING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class CompetitionType(str, enum.Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


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


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(128), nullable=False)
    type = Column(Enum(CompetitionType, name="competition_type", create_constraint=True), nullable=False, default=CompetitionType.PUBLIC)
    room_code = Column(String(32), nullable=True, unique=True)
    status = Column(Enum(CompetitionStatus, name="competition_status", create_constraint=True), nullable=False, default=CompetitionStatus.WAITING)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    starting_balance = Column(Numeric(18, 6), nullable=False, default=100000.0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Participant(Base):
    """Mapping table linking a User to a specific Competition."""
    __tablename__ = "participants"
    __table_args__ = (
        Index("ix_participants_user_comp", "user_id", "competition_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=False)
    current_fiat = Column(Numeric(18, 6), nullable=False, default=100000.0)
    current_asset = Column(Numeric(18, 6), nullable=False, default=0.0)
    realized_pnl = Column(Numeric(18, 6), nullable=False, default=0.0)
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
    """Central Limit Order Book (CLOB) — scoped to competition_id."""
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_orders_quantity_positive"),
        CheckConstraint("price IS NULL OR price > 0", name="ck_orders_price_positive"),
        Index("ix_orders_book_lookup", "competition_id", "asset_id", "side", "status", "price"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    side = Column(Enum(OrderSide, name="order_side", create_constraint=True), nullable=False)
    order_type = Column(Enum(OrderType, name="order_type", create_constraint=True), nullable=False, default=OrderType.LIMIT)
    price = Column(Numeric(18, 6), nullable=True)  # NULL for MARKET orders
    quantity = Column(Numeric(18, 6), nullable=False)
    status = Column(Enum(OrderStatus, name="order_status", create_constraint=True), nullable=False, default=OrderStatus.OPEN)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    filled_at = Column(DateTime(timezone=True), nullable=True)


class Trade(Base):
    """Immutable execution ledger."""
    __tablename__ = "trades"
    __table_args__ = (
        Index("ix_trades_lookup", "competition_id", "asset_id", "executed_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    matched_order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    price = Column(Numeric(18, 6), nullable=False)
    quantity = Column(Numeric(18, 6), nullable=False)
    total_value = Column(Numeric(18, 6), nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class Holding(Base):
    """Settled asset balances per participant."""
    __tablename__ = "holdings"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_holdings_quantity_nonneg"),
        Index("ix_holdings_participant_asset", "participant_id", "asset_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    quantity = Column(Numeric(18, 6), nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


class Position(Base):
    """Active positions tracking average entry price for P&L per participant."""
    __tablename__ = "positions"
    __table_args__ = (
        Index("ix_positions_participant_asset", "participant_id", "asset_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    quantity = Column(Numeric(18, 6), nullable=False, default=0)
    avg_entry_price = Column(Numeric(18, 6), nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


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


class Drawing(Base):
    """User-saved chart drawings (lines, shapes, text)."""
    __tablename__ = "drawings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    data = Column(JSON, nullable=False)  # Stores the serialized drawing objects
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
