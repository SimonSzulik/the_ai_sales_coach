"""Market & regulatory context enricher — two parallel LLM calls with web search."""

from __future__ import annotations

import asyncio
import logging

from app.llm import LLMError, complete_json, llm_configured
from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt A — Energy prices, building profile, local utility
# ---------------------------------------------------------------------------

PRICES_PROMPT = """\
You are a German energy market analyst. Given a residential address, use web \
search to find REAL current data. Be concise — every text value must be one \
short sentence or a few words maximum. Respond entirely in English.

Research these three areas:

1. **Building profile** — estimated construction era, building type \
(Einfamilienhaus, Mehrfamilienhaus, Reihenhaus, etc.), likely heating system, \
and historic preservation status (Denkmalschutz: "yes", "no", or "possible").

2. **Energy prices** — search Verivox, Check24, Chip.de, or Stadtwerke sites \
for the cheapest electricity tariff available at this zip code. Return the \
provider name, tariff name, and price in EUR/kWh. Also determine whether the \
local price trend is rising, stable, or falling.

3. **Local utility** — identify the local Stadtwerke / default energy provider. \
Find their website, any notable local tariffs (Ökostrom, dynamic), and local \
energy programs.

For EVERY section, include a source_url and source_title linking to where you \
found the data. Use the web search tool to verify tariffs, utilities, and \
building context before concluding a field is unknown. \
Do **not** use the literal string "NAV". For any string field you cannot \
substantiate from sources, use JSON null (not the word "null" in quotes as text).

Respond ONLY with valid JSON matching this exact schema:
{
  "building_profile": {
    "estimated_era": "string | null",
    "building_type": "string | null",
    "likely_heating": "string | null",
    "historic_preservation": "yes" | "no" | "possible" | null,
    "source_url": "string | null",
    "source_title": "string | null"
  },
  "energy_prices": {
    "cheapest_provider": "string | null",
    "cheapest_tariff_name": "string | null",
    "price_eur_kwh": "number | null",
    "trend": "rising" | "stable" | "falling" | null,
    "trend_detail": "string | null",
    "source_url": "string | null",
    "source_title": "string | null"
  },
  "local_utility": {
    "name": "string | null",
    "website": "string | null",
    "local_tariffs": "string | null",
    "local_programs": "string | null",
    "source_url": "string | null",
    "source_title": "string | null"
  }
}
"""

# ---------------------------------------------------------------------------
# Prompt B — Regulations, municipal programs, why-now triggers
# ---------------------------------------------------------------------------

REGULATIONS_PROMPT = """\
You are a German energy policy researcher. Given a residential address, use \
web search to find REAL current regulations, subsidies, and municipal programs \
relevant to this specific location. Be concise. Respond entirely in English.

Research these areas:

1. **Local regulations** — Bundesland-level solar obligations (Solarpflicht), \
GEG (Gebäudeenergiegesetz) implications, municipal building code specifics. \
Only include regulations that actually apply to this location or country.

2. **Municipal programs** — local Stadtwerke offers, municipal Klimaschutzkonzept \
programs, local Fördermittel on top of federal KfW/BAFA. Search city websites \
and Stadtseiten for energy programs.

3. **Why now** — 3-5 short bullet points (max 10 words each) explaining why \
the customer should act now. Focus on subsidy deadlines, price trends, and \
regulatory changes.

For regulations and programs, include source_url and source_title. \
Use web search for city/Land-level facts. Do **not** use the literal string \
"NAV"; use JSON null for unknown string fields.

Respond ONLY with valid JSON matching this exact schema:
{
  "local_regulations": [
    {
      "regulation": "string | null",
      "status": "string | null",
      "relevance": "string | null",
      "source_url": "string | null",
      "source_title": "string | null"
    }
  ],
  "municipal_programs": [
    {
      "name": "string | null",
      "provider": "string | null",
      "benefit": "string | null",
      "source_url": "string | null",
      "source_title": "string | null"
    }
  ],
  "why_now": ["string — short bullet, max 10 words"]
}
"""


async def enrich_market_context(
    address: str,
    zip_code: str,
    product_interest: str | None,
) -> EnrichmentResult:
    if not llm_configured():
        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={"error": "No LLM provider configured"},
        )

    user_msg = (
        f"Customer address: {address}, {zip_code}, Germany\n"
        f"Product interest: {product_interest or 'Solar'}\n\n"
    )

    try:
        prices_data, regulations_data = await asyncio.gather(
            complete_json(
                system=PRICES_PROMPT,
                user=user_msg + "Find energy prices, building profile, and local utility for this address.",
                max_tokens=4096,
                temperature=0.3,
                web_search=True,
                openai_allow_chat_fallback_when_web_search=False,
            ),
            complete_json(
                system=REGULATIONS_PROMPT,
                user=user_msg + "Find local regulations, municipal programs, and why-now triggers for this address.",
                max_tokens=4096,
                temperature=0.3,
                web_search=True,
                openai_allow_chat_fallback_when_web_search=False,
            ),
        )

        merged = {**prices_data, **regulations_data}

        sources = []
        for section_key in ["building_profile", "energy_prices", "local_utility"]:
            section = merged.get(section_key, {})
            if isinstance(section, dict) and section.get("source_url"):
                sources.append({
                    "title": section.get("source_title", section_key),
                    "url": section["source_url"],
                    "type": "data",
                })
        for reg in merged.get("local_regulations", []):
            if isinstance(reg, dict) and reg.get("source_url"):
                sources.append({
                    "title": reg.get("source_title", reg.get("regulation", "")),
                    "url": reg["source_url"],
                    "type": "regulation",
                })
        for prog in merged.get("municipal_programs", []):
            if isinstance(prog, dict) and prog.get("source_url"):
                sources.append({
                    "title": prog.get("source_title", prog.get("name", "")),
                    "url": prog["source_url"],
                    "type": "program",
                })

        merged["sources"] = sources

        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.MEDIUM,
            data=merged,
        )
    except (LLMError, Exception) as exc:
        logger.exception("Market context enrichment failed")
        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.NONE,
            fallback_used=True,
            error=str(exc),
            data={"error": f"AI research failed: {exc}"},
        )
