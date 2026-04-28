"""
SQLAlchemy models for the simtrade synthetic exchange.
Maps directly to the schema defined in 3-Architecture.md.

Uses String-based UUIDs for cross-DB compatibility (SQLite dev / PostgreSQL prod).
"""

import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Float, Boolean, Integer, Numeric,
    DateTime, Enum as SAEnum, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    PARTICIPANT = "PARTICIPANT"
    ADMIN = "ADMIN"


class TradeType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class NewsSentiment(str, enum.Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    CRASH = "CRASH"
    MOON = "MOON"


# ── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.PARTICIPANT)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    symbol = Column(String(10), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False)
    fiat_balance = Column(Numeric(precision=12, scale=2), nullable=False, default=10000.00)
    asset_quantity = Column(Numeric(precision=12, scale=4), nullable=False, default=0)

    user = relationship("User", back_populates="portfolios")
    asset = relationship("Asset")

    __table_args__ = (
        UniqueConstraint("user_id", "asset_id", name="uq_user_asset"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False)
    type = Column(SAEnum(TradeType), nullable=False)
    quantity = Column(Numeric(precision=12, scale=4), nullable=False)
    price_per_unit = Column(Numeric(precision=12, scale=2), nullable=False)
    total_cost = Column(Numeric(precision=12, scale=2), nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="transactions")
    asset = relationship("Asset")


class NewsEvent(Base):
    __tablename__ = "news_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    sentiment = Column(SAEnum(NewsSentiment), nullable=False)
    magnitude = Column(Float, nullable=False, default=1.0)
    duration_seconds = Column(Integer, nullable=False, default=30)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)
