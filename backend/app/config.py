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
    # gpt-4.1 supports Responses API web_search; gpt-4.1-nano does not.
    openai_model: str = "gpt-4.1"
    # ISO 3166-1 alpha-2 for web_search user_location (German leads by default).
    openai_web_search_country: str = "DE"
    # low | medium | high — larger context = more search depth (cost/latency).
    openai_web_search_context_size: str = "medium"

    google_maps_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./sales_coach.db"
    redis_url: str = "redis://localhost:6379/0"
    backend_port: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
