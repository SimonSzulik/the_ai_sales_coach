"""Market & regulatory context enricher — AI-powered via Anthropic Claude."""

from __future__ import annotations

import json
import logging
import re

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

MARKET_CONTEXT_PROMPT = """\
You are a German energy market research analyst preparing a local market brief \
for a sales representative who is about to visit a residential customer.

Given the customer's address, research and compile a structured market & \
regulatory context report. Reason from your knowledge of German energy policy, \
building stock, municipal programs, and local utility providers.

Research as if you were preparing a local market brief for an energy sales rep \
visiting this exact neighbourhood. Be as specific and factual as possible.

Cover these areas:

1. **Energy prices** — local retail electricity price estimate (EUR/kWh), \
   price trend (rising/stable/falling), impact of CO2 pricing (Brennstoffemissionshandelsgesetz).

2. **Building profile** — estimated construction era based on the neighbourhood, \
   likely current heating system, monument protection risk (Denkmalschutz), \
   building type (single-family, multi-family, Reihenhaus, etc.).

3. **Local regulations** — Bundesland-level solar obligations (Solarpflicht), \
   any municipal building code specifics, GEG (Gebäudeenergiegesetz) implications, \
   upcoming regulatory deadlines.

4. **Neighbour adoption** — estimated solar/heat-pump adoption rate in the area, \
   whether the neighbourhood shows visible solar panels, any known Solarkataster data.

5. **Municipal programs** — local Stadtwerke offers, municipal Klimaschutzkonzept \
   programs, local Fördermittel (subsidies) on top of federal KfW/BAFA. \
   Search for any city-specific ("Stadtseiten") energy programs, community solar \
   initiatives, or local utility incentives.

6. **Local utility** — name of the local Stadtwerke / energy provider, any special \
   tariffs (Ökostrom, dynamic tariffs), community energy programs.

7. **Why now triggers** — specific upcoming deadlines, subsidy budget exhaustion \
   risks, price trajectory, regulatory changes that create urgency.

Respond ONLY with valid JSON matching this schema:
{
  "energy_prices": {
    "local_retail_eur_kwh": number,
    "trend": "rising" | "stable" | "falling",
    "carbon_price_impact": "string — brief explanation"
  },
  "building_profile": {
    "estimated_era": "string — e.g. 1960s multi-family",
    "likely_heating": "string — e.g. Gas central heating",
    "monument_protection": "unlikely" | "possible" | "likely",
    "building_type": "string — e.g. Mehrfamilienhaus"
  },
  "local_regulations": [
    {"regulation": "string", "status": "string", "relevance": "string"}
  ],
  "neighbour_adoption": {
    "solar_visible": "high" | "moderate" | "low" | "unknown",
    "notes": "string"
  },
  "municipal_programs": [
    {"name": "string", "provider": "string", "description": "string", "amount_or_benefit": "string"}
  ],
  "local_utility": {
    "name": "string",
    "special_tariffs": "string",
    "community_programs": "string"
  },
  "why_now_triggers": ["string"],
  "research_notes": "string — any caveats or assumptions"
}
"""


async def enrich_market_context(
    address: str,
    zip_code: str,
    city: str,
    product_interest: str | None,
) -> EnrichmentResult:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={"error": "ANTHROPIC_API_KEY not configured"},
        )

    user_msg = (
        f"Customer address: {address}, {zip_code} {city}, Germany\n"
        f"Product interest: {product_interest or 'Solar'}\n\n"
        "Compile the market & regulatory context report for this location."
    )

    try:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0.4,
            system=MARKET_CONTEXT_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        raw = match.group(1).strip() if match else raw.strip()
        data = json.loads(raw)

        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.MEDIUM,
            data=data,
        )
    except Exception as exc:
        logger.exception("Market context enrichment failed")
        return EnrichmentResult(
            source="market_context_ai",
            confidence=Confidence.NONE,
            fallback_used=True,
            error=str(exc),
            data={"error": f"AI research failed: {exc}"},
        )
