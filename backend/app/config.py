from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- LLM provider switch ----------------------------------------------
    # Set LLM_PROVIDER=openai in the env to route every LLM call through
    # OpenAI instead of Anthropic. Default keeps existing behaviour.
    llm_provider: str = "anthropic"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    google_maps_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./sales_coach.db"
    redis_url: str = "redis://localhost:6379/0"
    backend_port: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
