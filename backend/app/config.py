"""
Synthex — Application configuration via Pydantic BaseSettings.
Loads values from the root .env file.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve project root: backend/app/config.py -> backend/app -> backend -> simtrade
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://synthex:synthex_dev@localhost:5432/synthex"
    ADMIN_API_KEY: str = "synthex-god-mode-key-2024"

    # Market parameters
    INITIAL_FAIR_VALUE: float = 100.00
    VOLATILITY: float = 0.50
    HALF_SPREAD: float = 0.50
    HOUSE_BOT_QUANTITY: int = 500
    INITIAL_FIAT_BALANCE: float = 10000.00


settings = Settings()
