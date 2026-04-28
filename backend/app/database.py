"""
Async SQLAlchemy engine, session factory, and database initialization.
Seeds the default $SIM asset and demo participant users on first run.

Supports both PostgreSQL (production) and SQLite (local dev without Docker).
"""

import os
import uuid
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, event

from app.models import Base, User, Asset, Portfolio, UserRole

load_dotenv()

# Default to SQLite for local dev if DATABASE_URL is not set or PostgreSQL is unavailable
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./simtrade.db",
)

# SQLite needs connect_args for check_same_thread
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine_kwargs = {
    "echo": False,
    "connect_args": connect_args,
}
if not is_sqlite:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Dependency for FastAPI route injection."""
    async with AsyncSessionLocal() as session:
        yield session


# ── Default seed data ────────────────────────────────────────────────────────

SIM_ASSET_ID = "00000000-0000-0000-0000-000000000001"

DEMO_USERS = [
    {"username": "Alice", "role": UserRole.PARTICIPANT},
    {"username": "Bob", "role": UserRole.PARTICIPANT},
    {"username": "Charlie", "role": UserRole.PARTICIPANT},
    {"username": "Diana", "role": UserRole.PARTICIPANT},
    {"username": "admin", "role": UserRole.ADMIN},
]

STARTING_FIAT = 10_000.00


async def init_db():
    """Create all tables and seed default data if empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Seed the $SIM asset
        existing_asset = await session.get(Asset, SIM_ASSET_ID)
        if not existing_asset:
            sim_asset = Asset(id=SIM_ASSET_ID, symbol="SIM", name="Synthex Simulated Equity")
            session.add(sim_asset)
            await session.flush()

            # Seed demo users with portfolios
            for user_data in DEMO_USERS:
                user = User(username=user_data["username"], role=user_data["role"])
                session.add(user)
                await session.flush()

                if user.role == UserRole.PARTICIPANT:
                    portfolio = Portfolio(
                        user_id=user.id,
                        asset_id=SIM_ASSET_ID,
                        fiat_balance=STARTING_FIAT,
                        asset_quantity=0,
                    )
                    session.add(portfolio)

            await session.commit()
