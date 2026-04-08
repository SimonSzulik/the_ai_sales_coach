"""Pipeline orchestrator — runs enrichers, engine, and coach in sequence."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.config import get_settings
from app.database import async_session
from app.models import (
    BriefingResponse,
    Confidence,
    DataTrustEntry,
    EnrichmentBundle,
    EnrichmentResult,
    LeadResponse,
    LeadRow,
)
from app.enrichers.geocoding import enrich_geo
from app.enrichers.solar import enrich_solar
from app.enrichers.energy_prices import enrich_energy
from app.enrichers.subsidies import enrich_subsidies
from app.engine.offers import build_offers
from app.engine.financing import compute_financing
from app.coach.sales_coach import generate_coaching

logger = logging.getLogger(__name__)


def _score(bundle: EnrichmentBundle) -> tuple[float, list[str]]:
    """Compute a 0-100 opportunity score from enrichment data."""
    score = 50.0
    drivers: list[str] = []

    solar = bundle.solar.data
    if solar.get("annual_kwh_per_kwp") and solar["annual_kwh_per_kwp"] > 1000:
        score += 15
        drivers.append(f"Good solar yield ({solar['annual_kwh_per_kwp']:.0f} kWh/kWp)")

    energy = bundle.energy.data
    if energy.get("retail_price_eur_kwh", 0) > 0.30:
        score += 10
        drivers.append(f"High electricity price ({energy['retail_price_eur_kwh']:.2f} EUR/kWh)")

    subs = bundle.subsidies.data
    if subs.get("total_potential_eur", 0) > 3000:
        score += 15
        drivers.append(f"Significant subsidies available ({subs['total_potential_eur']:.0f} EUR)")

    confidence_vals = {"high": 10, "medium": 5, "low": 0, "none": -5}
    for field in [bundle.geo, bundle.solar, bundle.energy, bundle.subsidies]:
        score += confidence_vals.get(field.confidence.value, 0)

    return max(0.0, min(100.0, score)), drivers


def _build_trust(bundle: EnrichmentBundle) -> list[DataTrustEntry]:
    entries = []
    for enricher_name, result in [
        ("Geocoding", bundle.geo),
        ("Solar Potential", bundle.solar),
        ("Energy Prices", bundle.energy),
        ("Subsidies", bundle.subsidies),
    ]:
        entries.append(DataTrustEntry(
            enricher=enricher_name,
            source=result.source,
            confidence=result.confidence,
            timestamp=result.timestamp,
            fallback_used=result.fallback_used,
        ))
    return entries


async def run_pipeline(lead_id: str) -> None:
    """Background task: enrich lead -> build offers -> generate coaching."""
    async with async_session() as db:
        row = await db.get(LeadRow, lead_id)
        if not row:
            logger.error("Lead %s not found", lead_id)
            return

        row.status = "processing"
        await db.commit()

        try:
            geo_result, solar_result, energy_result, subsidy_result = await asyncio.gather(
                enrich_geo(row.address, row.zip_code),
                enrich_solar(None, None),  # will be updated after geo
                enrich_energy(),
                enrich_subsidies(row.product_interest),
            )

            # Re-run solar with actual coordinates if geo succeeded
            lat = geo_result.data.get("latitude")
            lon = geo_result.data.get("longitude")
            if lat and lon:
                solar_result = await enrich_solar(lat, lon)

            bundle = EnrichmentBundle(
                geo=geo_result,
                solar=solar_result,
                energy=energy_result,
                subsidies=subsidy_result,
            )
            bundle.opportunity_score, bundle.opportunity_drivers = _score(bundle)

            offers_raw = build_offers(bundle)
            offers_with_financing = []
            for offer in offers_raw:
                subsidy_total = bundle.subsidies.data.get("total_potential_eur", 0.0)
                financing = compute_financing(offer, subsidy_total)
                from app.models import OfferWithFinancing
                offers_with_financing.append(OfferWithFinancing(offer=offer, financing=financing))

            lead_resp = LeadResponse.model_validate(row)

            coach_output = await generate_coaching(lead_resp, bundle, offers_with_financing)

            trust = _build_trust(bundle)

            briefing = BriefingResponse(
                lead=lead_resp,
                enrichment=bundle,
                offers=offers_with_financing,
                coach=coach_output,
                data_trust=trust,
            )

            row.enrichment_data = bundle.model_dump(mode="json")
            row.briefing_data = briefing.model_dump(mode="json")
            row.status = "done"
            await db.commit()

        except Exception:
            logger.exception("Pipeline failed for lead %s", lead_id)
            row.status = "error"
            row.briefing_data = {"error": "Pipeline failed"}
            await db.commit()
