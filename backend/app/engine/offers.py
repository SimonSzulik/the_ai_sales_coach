"""Deterministic offer builder — 3 tiers personalised from enrichment data."""

from __future__ import annotations

from app.models import EnrichmentBundle, Offer, OfferComponent, OfferTier

PV_COST_PER_KWP = 1_400
BATTERY_COST_PER_KWH = 800
HEAT_PUMP_COST = 15_000
WALLBOX_COST = 1_500

CO2_KG_PER_KWH_GRID = 0.4


def _extract_market_hints(bundle: EnrichmentBundle) -> dict:
    """Pull personalisation signals from market_context enrichment."""
    mc = bundle.market_context.data
    bp = mc.get("building_profile", {})
    return {
        "building_type": bp.get("building_type", ""),
        "estimated_era": bp.get("estimated_era", ""),
        "likely_heating": bp.get("likely_heating", "").lower(),
        "monument_protection": bp.get("monument_protection", "unlikely").lower(),
        "has_solar_obligation": any(
            "solarpflicht" in r.get("regulation", "").lower()
            for r in mc.get("local_regulations", [])
        ),
        "local_utility": mc.get("local_utility", {}).get("name", ""),
        "energy_trend": mc.get("energy_prices", {}).get("trend", "stable"),
    }


def build_offers(bundle: EnrichmentBundle) -> list[Offer]:
    solar = bundle.solar.data
    energy = bundle.energy.data
    hints = _extract_market_hints(bundle)

    annual_yield_per_kwp = solar.get("annual_kwh_per_kwp", 950.0)
    retail_price = energy.get("retail_price_eur_kwh", 0.35)
    sc_no_batt = 0.30
    sc_batt = 0.65
    sc_full = 0.75

    monument = hints["monument_protection"]
    is_constrained = monument in ("likely", "possible")
    building_type = hints["building_type"] or "residential building"
    heating = hints["likely_heating"]
    has_heat_pump_already = "heat pump" in heating or "wärmepumpe" in heating
    solar_obligation = hints["has_solar_obligation"]

    starter_kwp = 4.0 if is_constrained else 5.0
    rec_kwp = 6.0 if is_constrained else 8.0
    rec_batt = 7.0 if is_constrained else 10.0
    prem_kwp = 8.0 if is_constrained else 10.0
    prem_batt = 10.0 if is_constrained else 15.0

    starter_rationale = _starter_rationale(building_type, solar_obligation, is_constrained)
    rec_rationale = _recommended_rationale(building_type, hints["energy_trend"], is_constrained)
    prem_rationale = _premium_rationale(
        building_type, heating, has_heat_pump_already, is_constrained
    )

    return [
        _starter(annual_yield_per_kwp, retail_price, sc_no_batt, starter_kwp, starter_rationale),
        _recommended(annual_yield_per_kwp, retail_price, sc_batt, rec_kwp, rec_batt, rec_rationale),
        _premium(
            annual_yield_per_kwp, retail_price, sc_full,
            prem_kwp, prem_batt, has_heat_pump_already, prem_rationale,
        ),
    ]


def _starter_rationale(building_type: str, solar_obligation: bool, constrained: bool) -> str:
    parts = [f"Entry-level solar for your {building_type}"]
    if solar_obligation:
        parts.append("meets Solarpflicht requirements")
    if constrained:
        parts.append("sized for potential heritage restrictions")
    return " — ".join(parts) + "."


def _recommended_rationale(building_type: str, energy_trend: str, constrained: bool) -> str:
    parts = [f"Best value for your {building_type} with battery self-consumption"]
    if energy_trend == "rising":
        parts.append("locks in savings against rising prices")
    if constrained:
        parts.append("adapted to building constraints")
    return " — ".join(parts) + "."


def _premium_rationale(
    building_type: str, heating: str, has_hp: bool, constrained: bool,
) -> str:
    if has_hp:
        parts = [f"Full energy package for your {building_type}, wallbox added (heat pump already present)"]
    elif "gas" in heating or "öl" in heating or "oil" in heating:
        parts = [f"Complete energy transition replacing {heating} with heat pump"]
    else:
        parts = [f"Maximum independence: solar + battery + heat pump + wallbox"]
    if constrained:
        parts.append("adjusted for heritage building considerations")
    return " — ".join(parts) + "."


def _starter(yield_kwp: float, price: float, sc_rate: float, kwp: float, rationale: str) -> Offer:
    annual_kwh = kwp * yield_kwp
    savings = annual_kwh * sc_rate * price
    capex = kwp * PV_COST_PER_KWP
    payback = capex / savings if savings > 0 else 99

    return Offer(
        tier=OfferTier.STARTER,
        label="Starter — Solar Only",
        rationale=rationale,
        components=[
            OfferComponent(name="Solar PV", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=capex),
        ],
        capex_eur=capex,
        annual_savings_eur=round(savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round(annual_kwh * sc_rate * CO2_KG_PER_KWH_GRID, 0),
    )


def _recommended(
    yield_kwp: float, price: float, sc_rate: float,
    kwp: float, battery_kwh: float, rationale: str,
) -> Offer:
    annual_kwh = kwp * yield_kwp
    savings = annual_kwh * sc_rate * price
    capex = kwp * PV_COST_PER_KWP + battery_kwh * BATTERY_COST_PER_KWH
    payback = capex / savings if savings > 0 else 99

    return Offer(
        tier=OfferTier.RECOMMENDED,
        label="Recommended — Solar + Battery",
        rationale=rationale,
        components=[
            OfferComponent(name="Solar PV", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=kwp * PV_COST_PER_KWP),
            OfferComponent(name="Battery", description=f"{battery_kwh:.0f} kWh lithium-ion", unit_cost_eur=battery_kwh * BATTERY_COST_PER_KWH),
        ],
        capex_eur=capex,
        annual_savings_eur=round(savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round(annual_kwh * sc_rate * CO2_KG_PER_KWH_GRID, 0),
    )


def _premium(
    yield_kwp: float, price: float, sc_rate: float,
    kwp: float, battery_kwh: float,
    has_heat_pump: bool, rationale: str,
) -> Offer:
    annual_kwh = kwp * yield_kwp
    savings_pv = annual_kwh * sc_rate * price
    savings_hp = 0 if has_heat_pump else 1_200
    total_savings = savings_pv + savings_hp

    components = [
        OfferComponent(name="Solar PV", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=kwp * PV_COST_PER_KWP),
        OfferComponent(name="Battery", description=f"{battery_kwh:.0f} kWh lithium-ion", unit_cost_eur=battery_kwh * BATTERY_COST_PER_KWH),
    ]
    capex = kwp * PV_COST_PER_KWP + battery_kwh * BATTERY_COST_PER_KWH + WALLBOX_COST

    if not has_heat_pump:
        components.append(OfferComponent(name="Heat Pump", description="Air-source heat pump", unit_cost_eur=HEAT_PUMP_COST))
        capex += HEAT_PUMP_COST

    components.append(OfferComponent(name="Wallbox", description="11 kW EV charging station", unit_cost_eur=WALLBOX_COST))

    payback = capex / total_savings if total_savings > 0 else 99
    co2_base = annual_kwh * sc_rate + (3000 if not has_heat_pump else 0)

    return Offer(
        tier=OfferTier.PREMIUM,
        label="Premium — Full Energy Package",
        rationale=rationale,
        components=components,
        capex_eur=capex,
        annual_savings_eur=round(total_savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round(co2_base * CO2_KG_PER_KWH_GRID, 0),
    )
