"""Sales coach synthesis powered by Anthropic Claude."""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.models import (
    EnrichmentBundle,
    LeadResponse,
    ObjectionRebuttal,
    OfferWithFinancing,
    SalesCoachOutput,
)

SYSTEM_PROMPT = """\
You are an expert sales coach for residential solar, battery, heat pump, and wallbox installations in Germany.

A sales representative is about to visit a potential customer. Your job is to prepare a concise, actionable sales briefing based on the data provided.

RULES:
- Always respond in English, even though the customer data is from Germany.
- Be specific to THIS customer's situation — use the actual numbers.
- The talk_track must be an array of 4-6 short bullet points (each 1-2 sentences max). Structure them as: greeting, key benefit, numbers/savings, subsidies, recommendation, call to action. Do NOT write a single long paragraph.
- Objections should be realistic for German homeowners.
- Qualifying questions should uncover information we don't have yet.
- The urgency statement must reference real deadlines, price trends, or regulations.
- If data confidence is low, mention what assumptions you're making.
- Respond ONLY with valid JSON matching the schema below.

OUTPUT JSON SCHEMA:
{
  "talk_track": ["string — each item is one short bullet point of the pitch"],
  "objections": [
    {"objection": "string", "rebuttal": "string"}
  ],
  "qualifying_questions": ["string"],
  "urgency_statement": "string — why the customer should act now",
  "confidence_disclaimer": "string — what we're uncertain about"
}
"""


def _build_context(
    lead: LeadResponse,
    enrichment: EnrichmentBundle,
    offers: list[OfferWithFinancing],
) -> str:
    ctx: dict[str, Any] = {
        "customer": {
            "name": lead.name,
            "address": lead.address,
            "zip_code": lead.zip_code,
            "product_interest": lead.product_interest,
        },
        "location": enrichment.geo.data,
        "solar_potential": enrichment.solar.data,
        "energy_prices": enrichment.energy.data,
        "subsidies": enrichment.subsidies.data,
        "market_context": enrichment.market_context.data,
        "opportunity_score": enrichment.opportunity_score,
        "opportunity_drivers": enrichment.opportunity_drivers,
        "offers": [
            {
                "tier": o.offer.tier.value,
                "label": o.offer.label,
                "capex_eur": o.offer.capex_eur,
                "annual_savings_eur": o.offer.annual_savings_eur,
                "payback_years": o.offer.payback_years,
                "co2_saved_kg": o.offer.co2_saved_kg,
                "financing": [f.model_dump() for f in o.financing],
            }
            for o in offers
        ],
        "data_confidence": {
            "geo": enrichment.geo.confidence.value,
            "solar": enrichment.solar.confidence.value,
            "energy": enrichment.energy.confidence.value,
            "subsidies": enrichment.subsidies.confidence.value,
            "market_context": enrichment.market_context.confidence.value,
        },
    }
    return json.dumps(ctx, indent=2, default=str)


async def generate_coaching(
    lead: LeadResponse,
    enrichment: EnrichmentBundle,
    offers: list[OfferWithFinancing],
) -> SalesCoachOutput:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    context = _build_context(lead, enrichment, offers)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        temperature=0.7,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Generate a sales briefing for this lead:\n\n{context}"},
        ],
    )

    raw = response.content[0].text
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    raw = match.group(1).strip() if match else raw.strip()
    data = json.loads(raw)
    raw_track = data.get("talk_track", [])
    if isinstance(raw_track, str):
        raw_track = [s.strip() for s in raw_track.split("\n") if s.strip()]

    return SalesCoachOutput(
        talk_track=raw_track,
        objections=[ObjectionRebuttal(**o) for o in data.get("objections", [])],
        qualifying_questions=data.get("qualifying_questions", []),
        urgency_statement=data.get("urgency_statement", ""),
        confidence_disclaimer=data.get("confidence_disclaimer", ""),
    )
