"""Unified LLM client wrapper.

Switch the active provider via the LLM_PROVIDER environment variable
(``anthropic`` — default — or ``openai``). Both providers are exposed
behind a single ``complete_json`` coroutine that returns a parsed dict.

When ``web_search=True`` the wrapper enables the provider's first-party
web search tool (Anthropic ``web_search_20250305`` or OpenAI Responses
``web_search_preview``) so callers don't need to know provider details.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def _extract_json(text: str) -> dict[str, Any]:
    """Pull a JSON object out of an LLM response (handles ``` fences)."""
    if not text:
        raise LLMError("Empty LLM response")
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = match.group(1).strip() if match else text.strip()
    # Some models prepend chatter — try to find first { ... last }
    if not raw.startswith("{"):
        first = raw.find("{")
        last = raw.rfind("}")
        if first != -1 and last != -1:
            raw = raw[first : last + 1]
    return json.loads(raw)


def get_provider() -> str:
    settings = get_settings()
    return (settings.llm_provider or "anthropic").lower().strip()


def get_active_model() -> str:
    settings = get_settings()
    if get_provider() == "openai":
        return settings.openai_model
    return settings.anthropic_model


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------

async def _anthropic_complete(
    *,
    system: str,
    user: str,
    max_tokens: int,
    temperature: float,
    web_search: bool,
) -> str:
    from anthropic import AsyncAnthropic

    settings = get_settings()
    if not settings.anthropic_api_key:
        raise LLMError("ANTHROPIC_API_KEY is not configured")

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    kwargs: dict[str, Any] = {
        "model": settings.anthropic_model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if web_search:
        kwargs["tools"] = [
            {"type": "web_search_20250305", "name": "web_search", "max_uses": 5}
        ]

    response = await client.messages.create(**kwargs)
    last_text = ""
    for block in response.content:
        if getattr(block, "type", None) == "text":
            last_text = block.text
    return last_text


# ---------------------------------------------------------------------------
# OpenAI backend
# ---------------------------------------------------------------------------

async def _openai_complete(
    *,
    system: str,
    user: str,
    max_tokens: int,
    temperature: float,
    web_search: bool,
) -> str:
    from openai import AsyncOpenAI

    settings = get_settings()
    if not settings.openai_api_key:
        raise LLMError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    if web_search:
        # Use the Responses API with the built-in web_search_preview tool.
        try:
            resp = await client.responses.create(
                model=settings.openai_model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                tools=[{"type": "web_search_preview"}],
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            return getattr(resp, "output_text", None) or _flatten_openai_response(resp)
        except Exception as exc:  # pragma: no cover - network/runtime fallback
            logger.warning("OpenAI web_search failed (%s); falling back to chat completion", exc)

    # Standard chat completion fallback.
    chat = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return chat.choices[0].message.content or ""


def _flatten_openai_response(resp: Any) -> str:
    parts: list[str] = []
    for item in getattr(resp, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                parts.append(text)
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def complete_json(
    *,
    system: str,
    user: str,
    max_tokens: int = 1500,
    temperature: float = 0.3,
    web_search: bool = False,
) -> dict[str, Any]:
    """Run an LLM completion expected to return JSON.

    Routes to the active provider (Anthropic or OpenAI) and returns the
    parsed JSON dict. Raises ``LLMError`` if the provider is unavailable
    or the response cannot be parsed.
    """
    provider = get_provider()
    if provider == "openai":
        text = await _openai_complete(
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            web_search=web_search,
        )
    else:
        text = await _anthropic_complete(
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            web_search=web_search,
        )
    return _extract_json(text)


def llm_configured() -> bool:
    """True if the active provider has its API key set."""
    settings = get_settings()
    if get_provider() == "openai":
        return bool(settings.openai_api_key)
    return bool(settings.anthropic_api_key)
