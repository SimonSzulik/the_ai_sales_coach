"""Deterministic offer builder — 3 tiers based on enrichment data."""

from __future__ import annotations

from app.models import EnrichmentBundle, Offer, OfferComponent, OfferTier

# Cost assumptions (EUR, 2025 German market averages)
PV_COST_PER_KWP = 1_400
BATTERY_COST_PER_KWH = 800
HEAT_PUMP_COST = 15_000
WALLBOX_COST = 1_500

CO2_KG_PER_KWH_GRID = 0.4


def build_offers(bundle: EnrichmentBundle) -> list[Offer]:
    solar = bundle.solar.data
    energy = bundle.energy.data

    annual_yield_per_kwp = solar.get("annual_kwh_per_kwp", 950.0)
    retail_price = energy.get("retail_price_eur_kwh", 0.35)
    self_consumption_rate_no_battery = 0.30
    self_consumption_rate_battery = 0.65
    self_consumption_rate_full = 0.75

    return [
        _starter(annual_yield_per_kwp, retail_price, self_consumption_rate_no_battery),
        _recommended(annual_yield_per_kwp, retail_price, self_consumption_rate_battery),
        _premium(annual_yield_per_kwp, retail_price, self_consumption_rate_full),
    ]


def _starter(yield_kwp: float, price: float, sc_rate: float) -> Offer:
    kwp = 5.0
    annual_kwh = kwp * yield_kwp
    savings = annual_kwh * sc_rate * price
    capex = kwp * PV_COST_PER_KWP
    payback = capex / savings if savings > 0 else 99

    return Offer(
        tier=OfferTier.STARTER,
        label="Starter — Solar Only",
        components=[
            OfferComponent(name="Solar PV System", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=capex),
        ],
        capex_eur=capex,
        annual_savings_eur=round(savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round(annual_kwh * sc_rate * CO2_KG_PER_KWH_GRID, 0),
    )


def _recommended(yield_kwp: float, price: float, sc_rate: float) -> Offer:
    kwp = 8.0
    battery_kwh = 10.0
    annual_kwh = kwp * yield_kwp
    savings = annual_kwh * sc_rate * price
    capex = kwp * PV_COST_PER_KWP + battery_kwh * BATTERY_COST_PER_KWH
    payback = capex / savings if savings > 0 else 99

    return Offer(
        tier=OfferTier.RECOMMENDED,
        label="Recommended — Solar + Battery",
        components=[
            OfferComponent(name="Solar PV System", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=kwp * PV_COST_PER_KWP),
            OfferComponent(name="Battery Storage", description=f"{battery_kwh:.0f} kWh lithium-ion", unit_cost_eur=battery_kwh * BATTERY_COST_PER_KWH),
        ],
        capex_eur=capex,
        annual_savings_eur=round(savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round(annual_kwh * sc_rate * CO2_KG_PER_KWH_GRID, 0),
    )


def _premium(yield_kwp: float, price: float, sc_rate: float) -> Offer:
    kwp = 10.0
    battery_kwh = 15.0
    annual_kwh = kwp * yield_kwp
    savings_pv = annual_kwh * sc_rate * price
    savings_hp = 1_200  # estimated annual heating cost savings from heat pump vs gas
    total_savings = savings_pv + savings_hp
    capex = kwp * PV_COST_PER_KWP + battery_kwh * BATTERY_COST_PER_KWH + HEAT_PUMP_COST + WALLBOX_COST
    payback = capex / total_savings if total_savings > 0 else 99

    return Offer(
        tier=OfferTier.PREMIUM,
        label="Premium — Full Energy Package",
        components=[
            OfferComponent(name="Solar PV System", description=f"{kwp:.0f} kWp rooftop PV", unit_cost_eur=kwp * PV_COST_PER_KWP),
            OfferComponent(name="Battery Storage", description=f"{battery_kwh:.0f} kWh lithium-ion", unit_cost_eur=battery_kwh * BATTERY_COST_PER_KWH),
            OfferComponent(name="Heat Pump", description="Air-source heat pump", unit_cost_eur=HEAT_PUMP_COST),
            OfferComponent(name="Wallbox", description="11 kW EV charging station", unit_cost_eur=WALLBOX_COST),
        ],
        capex_eur=capex,
        annual_savings_eur=round(total_savings, 0),
        payback_years=round(payback, 1),
        co2_saved_kg=round((annual_kwh * sc_rate + 3000) * CO2_KG_PER_KWH_GRID, 0),
    )
