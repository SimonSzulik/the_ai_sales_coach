"""Pipeline orchestrator — runs enrichers, engine, and coach in sequence."""

from __future__ import annotations

import asyncio
import logging

from app.database import async_session
from app.models import (
    BriefingResponse,
    DataTrustEntry,
    EnrichmentBundle,
    LeadResponse,
    LeadRow,
    OfferWithFinancing,
)
from app.enrichers.geocoding import enrich_geo
from app.enrichers.solar import enrich_solar
from app.enrichers.energy_prices import enrich_energy
from app.enrichers.subsidies import enrich_subsidies
from app.enrichers.market_context import enrich_market_context
from app.enrichers.roof_analysis import enrich_roof
from app.enrichers.osint import enrich_osint
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

    osint = bundle.osint.data
    if osint.get("ev_status") == "yes":
        score += 5
        drivers.append("Customer already owns an EV (OSINT)")

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
        ("Market Context", bundle.market_context),
        ("Roof Analysis", bundle.roof_analysis),
        ("OSINT (EV)", bundle.osint),
    ]:
        entries.append(DataTrustEntry(
            enricher=enricher_name,
            source=result.source,
            confidence=result.confidence,
            timestamp=result.timestamp,
            fallback_used=result.fallback_used,
        ))
    return entries


def _build_offers_and_financing(
    bundle: EnrichmentBundle, household_kwh: float | None = None
) -> list[OfferWithFinancing]:
    if household_kwh is not None:
        offers_raw = build_offers(bundle, household_kwh=household_kwh)
    else:
        offers_raw = build_offers(bundle)
    subsidy_total = bundle.subsidies.data.get("total_potential_eur", 0.0)

    out: list[OfferWithFinancing] = []
    for offer in offers_raw:
        # If OSINT confirms EV ownership, the wallbox is already in place →
        # for the premium tier we strip its CapEx so financing reflects reality.
        ev_status = bundle.osint.data.get("ev_status")
        if ev_status == "yes" and offer.tier.value == "premium":
            wallbox_components = [c for c in offer.components if "wallbox" in c.name.lower()]
            for c in wallbox_components:
                offer.capex_eur = max(0.0, offer.capex_eur - c.unit_cost_eur)
                offer.components.remove(c)

        financing = compute_financing(offer, subsidy_total)
        out.append(OfferWithFinancing(offer=offer, financing=financing))
    return out


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
            (
                geo_result,
                solar_result,
                energy_result,
                subsidy_result,
                market_ctx_result,
                roof_result,
                osint_result,
            ) = await asyncio.gather(
                enrich_geo(row.address, row.zip_code),
                enrich_solar(None, None),
                enrich_energy(),
                enrich_subsidies(row.address, row.zip_code, row.product_interest),
                enrich_market_context(row.address, row.zip_code, row.product_interest),
                enrich_roof(row.address, row.zip_code, row.id),
                enrich_osint(row.name, row.address, row.zip_code),
            )

            lat = geo_result.data.get("latitude")
            lon = geo_result.data.get("longitude")
            if lat and lon:
                solar_result = await enrich_solar(lat, lon)

            bundle = EnrichmentBundle(
                geo=geo_result,
                solar=solar_result,
                energy=energy_result,
                subsidies=subsidy_result,
                market_context=market_ctx_result,
                roof_analysis=roof_result,
                osint=osint_result,
            )
            bundle.opportunity_score, bundle.opportunity_drivers = _score(bundle)

            offers_with_financing = _build_offers_and_financing(
                bundle, household_kwh=row.annual_electricity_kwh
            )

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


async def recompute_offers_only(
    lead_id: str, annual_electricity_kwh: float
) -> BriefingResponse | None:
    """Rebuild offers + financing for an already-enriched lead."""
    async with async_session() as db:
        row = await db.get(LeadRow, lead_id)
        if not row or row.status != "done" or not row.enrichment_data:
            return None

        try:
            bundle = EnrichmentBundle.model_validate(row.enrichment_data)
        except Exception:
            logger.exception("Failed to load enrichment bundle for %s", lead_id)
            return None

        offers_with_financing = _build_offers_and_financing(
            bundle, household_kwh=annual_electricity_kwh
        )

        # Reuse the previously generated coach output if present, otherwise regen.
        coach_output = None
        if row.briefing_data and isinstance(row.briefing_data, dict):
            coach_data = row.briefing_data.get("coach")
            if coach_data:
                from app.models import SalesCoachOutput
                try:
                    coach_output = SalesCoachOutput.model_validate(coach_data)
                except Exception:
                    coach_output = None

        row.annual_electricity_kwh = annual_electricity_kwh
        lead_resp = LeadResponse.model_validate(row)
        if coach_output is None:
            coach_output = await generate_coaching(lead_resp, bundle, offers_with_financing)

        trust = _build_trust(bundle)

        briefing = BriefingResponse(
            lead=lead_resp,
            enrichment=bundle,
            offers=offers_with_financing,
            coach=coach_output,
            data_trust=trust,
        )

        row.briefing_data = briefing.model_dump(mode="json")
        await db.commit()
        return briefing
