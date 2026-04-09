"""Subsidy enricher — uses the active LLM (Anthropic or OpenAI) with web search."""

from __future__ import annotations

import logging

from app.llm import LLMError, complete_json, llm_configured
from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

SUBSIDIES_PROMPT = """\
You are a German energy subsidy (Fördermittel) expert.
Given a customer's address and their product interest (e.g., Solar, Battery, Heat Pump), \
use web search to find REAL, CURRENT (2025/2026) subsidies they are eligible for.

Search for:
1. Federal programs (e.g., KfW, BAFA).
2. State-level programs (Bundesland).
3. Municipal programs (Stadt/Kommune) specifically for their zip code/city.

CRITICAL RULES:
- Only include ACTIVE programs. (e.g., KfW 442 is currently exhausted, do NOT include it).
- Only include subsidies that match the user's product interest (e.g., if they only want "Solar", do NOT add Heat Pump subsidies).
- "amount_eur" must be a realistic estimate of the direct grant (Zuschuss) in EUR.
- For loans (like KfW 270) or tax exemptions (0% MwSt), "amount_eur" MUST be 0.
- "total_potential_eur" is the SUM of "amount_eur" from all programs combined.
- Respond entirely in English.

Respond ONLY with valid JSON matching this exact schema:
{
  "programs": [
    {
      "name": "string (e.g., KfW 270, BEG EM, Förderprogramm München)",
      "provider": "string (e.g., KfW, BAFA, Stadt Stuttgart)",
      "amount_eur": number,
      "type": "grant" | "low_interest_loan" | "tax_exemption" | "feed_in_tariff",
      "notes": "string (1-2 sentences explaining what it covers)",
      "deadline": "string | null"
    }
  ],
  "total_potential_eur": number
}
"""


async def enrich_subsidies(address: str, zip_code: str, product_interest: str | None) -> EnrichmentResult:
    if not llm_configured():
        return _fallback_subsidies(product_interest, "No LLM provider configured")

    user_msg = (
        f"Location: {address}, {zip_code}, Germany\n"
        f"Interested in: {product_interest or 'Solar, Battery'}\n\n"
        "Find applicable federal, state, and local subsidies for this specific location and product."
    )

    try:
        data = await complete_json(
            system=SUBSIDIES_PROMPT,
            user=user_msg,
            max_tokens=1500,
            temperature=0.2,
            web_search=True,
        )

        total = float(data.get("total_potential_eur", 0.0))
        programs = data.get("programs", [])

        return EnrichmentResult(
            source="subsidies_ai",
            confidence=Confidence.HIGH if programs else Confidence.MEDIUM,
            data={
                "programs": programs,
                "total_potential_eur": total,
            },
        )

    except (LLMError, Exception) as exc:
        logger.exception("Subsidy AI enrichment failed")
        return _fallback_subsidies(product_interest, str(exc))


def _fallback_subsidies(product_interest: str | None, reason: str) -> EnrichmentResult:
    """Fallback static logic in case the AI call fails or times out."""
    interest = (product_interest or "solar").lower()
    keywords = {w.strip() for w in interest.replace(",", " ").split()}

    keyword_map = {
        "solar": "solar", "pv": "solar", "photovoltaik": "solar",
        "batterie": "battery", "battery": "battery", "speicher": "battery",
        "wärmepumpe": "heat_pump", "heat_pump": "heat_pump", "heatpump": "heat_pump",
        "wallbox": "wallbox", "ladesäule": "wallbox",
    }

    mapped = set()
    for kw in keywords:
        if kw in keyword_map:
            mapped.add(keyword_map[kw])

    if not mapped:
        mapped = {"solar"}

    static_catalog = [
        {
            "name": "KfW 270 – Erneuerbare Energien",
            "provider": "KfW",
            "amount_eur": 0,
            "type": "low_interest_loan",
            "products": ["solar"],
            "notes": "Low-interest loan for PV and storage up to 150,000 EUR",
        },
        {
            "name": "Local Battery Grant (Estimate)",
            "provider": "Kommune / Land",
            "amount_eur": 1200,
            "type": "grant",
            "products": ["battery"],
            "notes": "Estimated municipal grant for residential battery storage",
        },
        {
            "name": "BEG EM – Einzelmaßnahmen Wärmepumpe",
            "provider": "BAFA / KfW",
            "amount_eur": 7500,
            "type": "grant",
            "products": ["heat_pump"],
            "notes": "Up to 40%-70% of investment costs for heat pumps",
        },
    ]

    eligible = []
    total = 0.0
    for prog in static_catalog:
        if mapped & set(prog["products"]):
            eligible.append({k: v for k, v in prog.items() if k != "products"})
            total += prog["amount_eur"]

    return EnrichmentResult(
        source="kfw_bafa_static_fallback",
        confidence=Confidence.LOW,
        fallback_used=True,
        data={
            "programs": eligible,
            "total_potential_eur": total,
            "note": f"Fallback used: {reason}",
        },
    )
