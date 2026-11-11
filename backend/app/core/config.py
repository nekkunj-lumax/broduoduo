"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Brodoudou"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "dev-secret-change-me"
    currency: str = "USD"
    timezone: str = "UTC"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    database_url: str = (
        "postgresql+asyncpg://pindodo:pindodo_dev_password@localhost:5432/pindodo"
    )
    database_url_sync: str = (
        "postgresql://pindodo:pindodo_dev_password@localhost:5432/pindodo"
    )

    redis_url: str = "redis://localhost:6379/0"

    payment_provider: str = "simulated"
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    simulate_payments: bool = True

    default_group_size: int = 3
    default_group_expiration_hours: int = 24
    max_group_size: int = 10

    rate_limit_per_minute: int = 60
    seed_on_startup: bool = False

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
