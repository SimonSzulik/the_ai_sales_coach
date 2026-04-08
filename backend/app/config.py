from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./sales_coach.db"
    redis_url: str = "redis://localhost:6379/0"
    backend_port: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
