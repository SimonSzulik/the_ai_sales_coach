"""Unified LLM client wrapper.

Switch the active provider via the LLM_PROVIDER environment variable
(``anthropic`` — default — or ``openai``). Both providers are exposed
behind a single ``complete_json`` coroutine that returns a parsed dict.

When ``web_search=True`` the wrapper enables the provider's first-party
web search tool (Anthropic ``web_search_20250305`` or OpenAI Responses
built-in ``web_search`` with German ``user_location`` by default) so callers
don't need to know provider details.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import Settings, get_settings

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

def _openai_web_search_tool(settings: Settings) -> dict[str, Any]:
    """GA web_search tool for Responses API — grounded for DE by default."""
    cc = (settings.openai_web_search_country or "DE").strip().upper()[:2]
    if len(cc) != 2:
        cc = "DE"
    size = (settings.openai_web_search_context_size or "medium").strip().lower()
    if size not in ("low", "medium", "high"):
        size = "medium"
    return {
        "type": "web_search",
        "user_location": {"type": "approximate", "country": cc},
        "search_context_size": size,
    }


async def _openai_complete(
    *,
    system: str,
    user: str,
    max_tokens: int,
    temperature: float,
    web_search: bool,
    openai_allow_chat_fallback: bool = True,
) -> str:
    from openai import AsyncOpenAI

    settings = get_settings()
    if not settings.openai_api_key:
        raise LLMError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    if web_search:
        # Responses API + GA web_search (not preview); force tool use for grounded JSON.
        web_tool = _openai_web_search_tool(settings)
        try:
            resp = await client.responses.create(
                model=settings.openai_model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                tools=[web_tool],
                tool_choice={"type": "web_search"},
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            return getattr(resp, "output_text", None) or _flatten_openai_response(resp)
        except Exception as exc:  # pragma: no cover - network/runtime fallback
            if not openai_allow_chat_fallback:
                raise LLMError(
                    f"OpenAI Responses API with web_search failed (no chat fallback): {exc}"
                ) from exc
            logger.warning("OpenAI web_search failed (%s); falling back to chat completion", exc)

    # Standard chat completion (no live web search when used after failed Responses).
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
    openai_allow_chat_fallback_when_web_search: bool = True,
) -> dict[str, Any]:
    """Run an LLM completion expected to return JSON.

    Routes to the active provider (Anthropic or OpenAI) and returns the
    parsed JSON dict. Raises ``LLMError`` if the provider is unavailable
    or the response cannot be parsed.

    When ``web_search`` is True and the active provider is OpenAI, the Responses
    API is used first. If it fails, ``openai_allow_chat_fallback_when_web_search``
    controls whether to fall back to chat completions **without** live web search
    (default True for resilience). Callers that require real search results
    should pass False.
    """
    provider = get_provider()
    if provider == "openai":
        text = await _openai_complete(
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            web_search=web_search,
            openai_allow_chat_fallback=openai_allow_chat_fallback_when_web_search,
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
