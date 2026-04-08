"""Subsidy enricher — static rule-based for German KfW / BAFA programs (2025/2026)."""

from __future__ import annotations

from app.models import Confidence, EnrichmentResult

SUBSIDY_CATALOG: list[dict] = [
    {
        "name": "KfW 270 – Erneuerbare Energien",
        "provider": "KfW",
        "amount_eur": 0,
        "type": "low_interest_loan",
        "products": ["solar", "battery"],
        "notes": "Low-interest loan up to 150,000 EUR for PV + storage systems",
    },
    {
        "name": "BEG EM – Einzelmaßnahmen Wärmepumpe",
        "provider": "BAFA",
        "amount_eur": 7500,
        "type": "grant",
        "products": ["heat_pump"],
        "notes": "Up to 40% of investment costs for heat pump installation (max 60k base)",
    },
    {
        "name": "BEG EM – Einzelmaßnahmen Heizungsoptimierung",
        "provider": "BAFA",
        "amount_eur": 3000,
        "type": "grant",
        "products": ["heat_pump", "solar"],
        "notes": "Climate bonus of 20% for replacing old fossil heating",
    },
    {
        "name": "KfW 442 – Solarstrom für Elektroautos",
        "provider": "KfW",
        "amount_eur": 10200,
        "type": "grant",
        "products": ["solar", "battery", "wallbox"],
        "notes": "Combination grant: PV + storage + wallbox, up to 10,200 EUR",
        "deadline": "Budget dependent — check availability",
    },
    {
        "name": "Einspeisevergütung (EEG 2024)",
        "provider": "Bundesnetzagentur",
        "amount_eur": 0,
        "type": "feed_in_tariff",
        "products": ["solar"],
        "notes": "~8.1 ct/kWh for systems ≤10 kWp (partial feed-in), decreasing semi-annually",
    },
]


async def enrich_subsidies(product_interest: str | None) -> EnrichmentResult:
    interest = (product_interest or "solar").lower()
    keywords = {w.strip() for w in interest.replace(",", " ").split()}
    keyword_map = {
        "solar": "solar",
        "pv": "solar",
        "photovoltaik": "solar",
        "batterie": "battery",
        "battery": "battery",
        "speicher": "battery",
        "wärmepumpe": "heat_pump",
        "heat_pump": "heat_pump",
        "heatpump": "heat_pump",
        "wallbox": "wallbox",
        "ladesäule": "wallbox",
    }

    mapped = set()
    for kw in keywords:
        if kw in keyword_map:
            mapped.add(keyword_map[kw])
    if not mapped:
        mapped = {"solar"}

    eligible = []
    total = 0.0
    for prog in SUBSIDY_CATALOG:
        if mapped & set(prog["products"]):
            eligible.append(prog)
            total += prog["amount_eur"]

    return EnrichmentResult(
        source="kfw_bafa_static",
        confidence=Confidence.MEDIUM,
        data={
            "programs": eligible,
            "total_potential_eur": total,
            "product_categories_matched": sorted(mapped),
        },
    )
