from __future__ import annotations

import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ───────────────────────────────────────────────────────────
    APP_NAME: str = "Darukaa Mission Control"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────────────
    # Use asyncpg driver:  postgresql+asyncpg://user:pass@host:5432/db
    DATABASE_URL: str
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalise_db_url(cls, v: str) -> str:
        """Render (and Heroku) emit  postgres://  or  postgresql://
        SQLAlchemy async requires   postgresql+asyncpg://
        """
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v
    # ── Security ──────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────────────────────
    # Accepts a JSON array string:  '["https://app.vercel.app"]'
    CORS_ORIGINS: str = '["http://localhost:5173"]'

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str) -> str:
        # Accept both JSON array string and comma-separated string
        if isinstance(v, str) and not v.startswith("["):
            return json.dumps([o.strip() for o in v.split(",")])
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)


settings = Settings()  # type: ignore[call-arg]
