import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def drop_all():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        # Drop tables with CASCADE to handle foreign keys
        await conn.execute(text('DROP TABLE IF EXISTS trades, orders, portfolios, holdings, positions, news_events, market_state, users CASCADE'))
        # Drop custom types as well
        await conn.execute(text('DROP TYPE IF EXISTS user_role, order_side, order_type, order_status, news_sentiment CASCADE'))
    await engine.dispose()
    print("All tables and types dropped.")

if __name__ == "__main__":
    asyncio.run(drop_all())
