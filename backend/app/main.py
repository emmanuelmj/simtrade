"""
simtrade — FastAPI Application Entry Point.

Initializes the database, starts the tick engine as a background task,
and mounts all API/WebSocket routers.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.tick_engine import run_tick_loop
from app.routes.ws import router as ws_router
from app.routes.admin import router as admin_router

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + launch tick engine. Shutdown: cancel tick loop."""
    logger.info("🚀 simtrade starting up...")
    await init_db()
    logger.info("✅ Database initialized & seeded")

    tick_task = asyncio.create_task(run_tick_loop())
    logger.info("✅ Tick engine launched")

    yield

    logger.info("🛑 Shutting down tick engine...")
    tick_task.cancel()
    try:
        await tick_task
    except asyncio.CancelledError:
        pass


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="simtrade — Synthetic Exchange",
    description="A deterministic, real-time synthetic stock market for financial competitions.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(ws_router)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {
        "name": "simtrade",
        "status": "running",
        "docs": "/docs",
    }
