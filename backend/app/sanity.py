"""Deterministic sanity checks run after the pipeline finishes.

These act as a guardrail for the sales rep: they re-verify the headline
numbers (subsidy eligibility, payback range, capex/savings ratios, EV
finding consistency) and surface any obvious red flags so the rep doesn't
walk into a customer meeting with a number that doesn't add up.

Each check returns a ``SanityCheck`` row with a status:

* ``pass`` – the value looks reasonable
* ``warn`` – not necessarily wrong but worth double-checking
* ``fail`` – almost certainly wrong; the rep should not quote it
* ``info`` – contextual note (e.g. low data confidence)
"""

from __future__ import annotations

from typing import Iterable

from app.models import (
    EnrichmentBundle,
    LeadResponse,
    OfferWithFinancing,
    SanityCheck,
)


# ---------------------------------------------------------------------------
# Subsidy eligibility — keep flagged programs aligned with product interest
# ---------------------------------------------------------------------------

_PRODUCT_KEYWORDS = {
    "solar": {"solar", "pv", "photovoltaik", "270", "ee"},
    "battery": {"battery", "speicher", "batterie"},
    "heat_pump": {"heat", "wärmepumpe", "waermepumpe", "beg", "bafa"},
    "wallbox": {"wallbox", "ladestation", "ladesäule", "440", "441"},
}


def _interested_products(lead: LeadResponse) -> set[str]:
    interest = (lead.product_interest or "").lower()
    out: set[str] = set()
    for product, kws in _PRODUCT_KEYWORDS.items():
        if any(kw in interest for kw in kws):
            out.add(product)
    if not out:
        out = {"solar"}
    return out


def _program_matches(program: dict, products: set[str]) -> bool:
    name = " ".join(
        str(program.get(k, "")) for k in ("name", "provider", "notes", "type")
    ).lower()
    for product in products:
        if any(kw in name for kw in _PRODUCT_KEYWORDS[product]):
            return True
    return False


def _check_subsidy_alignment(
    lead: LeadResponse, bundle: EnrichmentBundle
) -> Iterable[SanityCheck]:
    programs = bundle.subsidies.data.get("programs", []) or []
    if not programs:
        yield SanityCheck(
            name="Subsidy availability",
            status="warn",
            message="No subsidy programs were resolved for this customer.",
            detail="Pipeline returned an empty programs list — fallback may be active.",
        )
        return

    interested = _interested_products(lead)
    mismatched = [p for p in programs if not _program_matches(p, interested)]
    if mismatched:
        names = ", ".join(p.get("name", "?") for p in mismatched[:3])
        yield SanityCheck(
            name="Subsidy alignment",
            status="warn",
            message=f"{len(mismatched)} subsidy program(s) don't clearly match the product interest.",
            detail=f"Customer interest: {sorted(interested)} · Off-topic programs: {names}",
        )
    else:
        yield SanityCheck(
            name="Subsidy alignment",
            status="pass",
            message="All listed subsidies match the customer's product interest.",
        )


def _check_subsidy_total(bundle: EnrichmentBundle) -> Iterable[SanityCheck]:
    programs = bundle.subsidies.data.get("programs", []) or []
    declared_total = float(bundle.subsidies.data.get("total_potential_eur", 0.0) or 0.0)
    summed = sum(float(p.get("amount_eur", 0) or 0) for p in programs)
    if abs(declared_total - summed) > 1.0:
        yield SanityCheck(
            name="Subsidy total integrity",
            status="fail",
            message="Declared total subsidy doesn't equal the sum of listed programs.",
            detail=f"declared={declared_total:.0f} EUR · summed={summed:.0f} EUR",
        )
    else:
        yield SanityCheck(
            name="Subsidy total integrity",
            status="pass",
            message=f"Subsidy total matches the listed programs ({summed:.0f} EUR).",
        )


# ---------------------------------------------------------------------------
# Offer math — payback, savings range, capex sanity
# ---------------------------------------------------------------------------

def _check_offers(offers: list[OfferWithFinancing]) -> Iterable[SanityCheck]:
    if not offers:
        yield SanityCheck(
            name="Offers generated",
            status="fail",
            message="No offers were generated for this lead.",
        )
        return

    for o in offers:
        offer = o.offer
        tier = offer.tier.value

        if offer.capex_eur <= 0:
            yield SanityCheck(
                name=f"{tier} CapEx",
                status="fail",
                message=f"{tier} offer has non-positive CapEx ({offer.capex_eur}).",
            )
            continue

        if offer.annual_savings_eur <= 0:
            yield SanityCheck(
                name=f"{tier} savings",
                status="fail",
                message=f"{tier} offer has non-positive annual savings ({offer.annual_savings_eur}).",
            )

        if offer.payback_years <= 0 or offer.payback_years > 30:
            yield SanityCheck(
                name=f"{tier} payback",
                status="warn",
                message=f"{tier} payback {offer.payback_years} yrs is outside the 0-30 yr realistic band.",
            )
        else:
            yield SanityCheck(
                name=f"{tier} payback",
                status="pass",
                message=f"{tier} payback {offer.payback_years} yrs is within the realistic 0-30 yr band.",
            )

        # Self-consumption sanity (PV cannot have >100% self-use)
        if offer.self_consumption_pct < 0 or offer.self_consumption_pct > 100:
            yield SanityCheck(
                name=f"{tier} self-consumption",
                status="fail",
                message=f"Self-consumption {offer.self_consumption_pct}% is outside 0-100%.",
            )

        # Roof utilization > 100% means we oversized the roof.
        if offer.roof_utilization_pct > 100:
            yield SanityCheck(
                name=f"{tier} roof utilization",
                status="fail",
                message=f"Roof utilization {offer.roof_utilization_pct}% exceeds 100%.",
            )


def _check_financing(offers: list[OfferWithFinancing]) -> Iterable[SanityCheck]:
    for o in offers:
        for f in o.financing:
            if f.monthly_payment_eur < 0:
                yield SanityCheck(
                    name=f"{o.offer.tier.value} financing ({f.type})",
                    status="fail",
                    message=f"Negative monthly payment ({f.monthly_payment_eur} EUR).",
                )
            if f.type != "cash" and f.total_cost_eur < o.offer.capex_eur * 0.5:
                yield SanityCheck(
                    name=f"{o.offer.tier.value} financing ({f.type})",
                    status="warn",
                    message="Total financed cost is suspiciously below the CapEx.",
                    detail=f"capex={o.offer.capex_eur:.0f} · total={f.total_cost_eur:.0f}",
                )


# ---------------------------------------------------------------------------
# OSINT consistency
# ---------------------------------------------------------------------------

def _check_osint(lead: LeadResponse, bundle: EnrichmentBundle) -> Iterable[SanityCheck]:
    osint = bundle.osint.data or {}
    status = osint.get("ev_status")
    if status not in {"yes", "no", "NA"}:
        yield SanityCheck(
            name="OSINT EV verdict",
            status="fail",
            message=f"Unexpected ev_status value '{status}'.",
        )
        return

    if status == "yes" and not osint.get("proof_image_url"):
        yield SanityCheck(
            name="OSINT EV verdict",
            status="warn",
            message="EV verdict 'yes' but no proof image URL was returned.",
        )
    elif status == "no" and not osint.get("proof_image_url"):
        yield SanityCheck(
            name="OSINT EV verdict",
            status="warn",
            message="EV verdict 'no' but no proof image URL was returned.",
        )
    else:
        yield SanityCheck(
            name="OSINT EV verdict",
            status="pass",
            message=f"EV verdict='{status}' is internally consistent.",
        )

    interest = (lead.product_interest or "").lower()
    if status == "yes" and "wallbox" in interest:
        yield SanityCheck(
            name="OSINT vs product interest",
            status="info",
            message="Customer interested in wallbox but OSINT indicates they already drive an EV — confirm whether they already have a charger.",
        )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_sanity_checks(
    lead: LeadResponse,
    bundle: EnrichmentBundle,
    offers: list[OfferWithFinancing],
) -> list[SanityCheck]:
    checks: list[SanityCheck] = []
    checks.extend(_check_subsidy_alignment(lead, bundle))
    checks.extend(_check_subsidy_total(bundle))
    checks.extend(_check_offers(offers))
    checks.extend(_check_financing(offers))
    checks.extend(_check_osint(lead, bundle))

    if bundle.geo.confidence.value in {"none", "low"}:
        checks.append(
            SanityCheck(
                name="Geocoding confidence",
                status="info",
                message=f"Geocoding confidence is {bundle.geo.confidence.value} — address may not have resolved cleanly.",
            )
        )
    return checks
