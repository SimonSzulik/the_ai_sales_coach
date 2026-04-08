"""Deterministic offer builder — 3 tiers sized from roof analysis data."""

from __future__ import annotations

from app.models import EnrichmentBundle, Offer, OfferComponent, OfferTier

PV_COST_PER_KWP = 1_400
BATTERY_COST_PER_KWH = 800
HEAT_PUMP_COST = 15_000
WALLBOX_COST = 1_500

CO2_KG_PER_KWH_GRID = 0.4
FEED_IN_TARIFF_EUR = 0.081
HOUSEHOLD_CONSUMPTION_KWH = 4_000
COMMON_BATTERY_SIZES = [5.0, 7.0, 10.0, 12.0, 15.0]

MAX_STARTER_KWP = 10.0
MAX_REC_KWP = 15.0
MAX_PREM_KWP = 20.0


_TILT_ROWS = [0, 10, 20, 30, 35, 45, 60, 90]

_YIELD_TABLE: dict[int, dict[str, float]] = {
    0:  {"S": 0.87, "SE": 0.87, "E": 0.87, "N": 0.87},
    10: {"S": 0.93, "SE": 0.92, "E": 0.89, "N": 0.83},
    20: {"S": 0.98, "SE": 0.96, "E": 0.88, "N": 0.74},
    30: {"S": 1.00, "SE": 0.97, "E": 0.86, "N": 0.65},
    35: {"S": 1.00, "SE": 0.97, "E": 0.84, "N": 0.61},
    45: {"S": 0.97, "SE": 0.94, "E": 0.79, "N": 0.53},
    60: {"S": 0.90, "SE": 0.86, "E": 0.71, "N": 0.42},
    90: {"S": 0.69, "SE": 0.65, "E": 0.54, "N": 0.25},
}


def _az_bucket(azimuth_deg: float) -> str:
    """Map azimuth (0-360, 180=south) to compass bucket for the yield table."""
    south_offset = abs(((azimuth_deg - 180) + 180) % 360 - 180)
    if south_offset <= 22.5:
        return "S"
    if south_offset <= 67.5:
        return "SE"
    if south_offset <= 112.5:
        return "E"
    return "N"


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _tilt_azimuth_factor(tilt_deg: float, azimuth_deg: float) -> float:
    """Fraction of optimal yield (0.25–1.0) via PVGIS lookup table for Germany.

    Uses bilinear interpolation over the standard German irradiation table
    (source: PVGIS simulation data for 51 deg N, ref: south/33 deg = 100%).
    """
    bucket = _az_bucket(azimuth_deg)
    clamped_tilt = max(0.0, min(90.0, tilt_deg))

    lo_idx = 0
    for i, t in enumerate(_TILT_ROWS):
        if t <= clamped_tilt:
            lo_idx = i
    hi_idx = min(lo_idx + 1, len(_TILT_ROWS) - 1)

    lo_tilt = _TILT_ROWS[lo_idx]
    hi_tilt = _TILT_ROWS[hi_idx]

    if lo_tilt == hi_tilt:
        return _YIELD_TABLE[lo_tilt][bucket]

    t = (clamped_tilt - lo_tilt) / (hi_tilt - lo_tilt)
    return _lerp(_YIELD_TABLE[lo_tilt][bucket], _YIELD_TABLE[hi_tilt][bucket], t)


def _nearest_battery(target_kwh: float) -> float:
    """Round to the nearest common battery size."""
    return min(COMMON_BATTERY_SIZES, key=lambda s: abs(s - target_kwh))


def _cap_system(kwp: float, kwh: float, max_kwp: float) -> tuple[float, float]:
    """Clamp system size to a residential maximum, scaling kWh proportionally."""
    if kwp <= max_kwp:
        return round(kwp, 1), round(kwh, 0)
    ratio = max_kwp / kwp
    return round(max_kwp, 1), round(kwh * ratio, 0)


def _extract_roof_planes(bundle: EnrichmentBundle) -> list[dict] | None:
    """Return sorted roof planes (best suitability first) or None if unavailable."""
    roof = bundle.roof_analysis.data
    if not roof or roof.get("error") or not roof.get("planes"):
        return None
    planes = list(roof["planes"])
    order = {"high": 0, "medium": 1, "low": 2}
    planes.sort(key=lambda p: (order.get(p.get("suitability", "low"), 2), -p.get("area_m2", 0)))
    return planes


def _select_planes(planes: list[dict], suitabilities: set[str]) -> list[dict]:
    return [p for p in planes if p.get("suitability", "low") in suitabilities]


def _compute_yield(planes: list[dict], annual_kwh_per_kwp: float) -> tuple[float, float]:
    """Compute (total_kwp, total_annual_kwh) applying per-plane tilt/azimuth correction."""
    total_kwp = 0.0
    total_kwh = 0.0
    for p in planes:
        kwp = p.get("estimated_kwp", 0.0)
        factor = _tilt_azimuth_factor(p.get("tilt_deg", 35), p.get("azimuth_deg", 180))
        total_kwp += kwp
        total_kwh += kwp * annual_kwh_per_kwp * factor
    return round(total_kwp, 1), round(total_kwh, 0)


def _self_consumption_rate(annual_kwh: float, battery_kwh: float, has_heat_pump: bool) -> float:
    """Realistic self-consumption model.

    Without battery: ~30% baseline
    Each kWh battery shifts ~250 kWh/yr from export to self-use.
    Heat pump adds flexible load, boosting self-consumption.
    """
    consumption = HOUSEHOLD_CONSUMPTION_KWH
    if has_heat_pump:
        consumption += 3_000

    if annual_kwh <= 0:
        return 0.0

    base_sc = min(0.30, consumption / annual_kwh) if annual_kwh > 0 else 0.30
    battery_boost = (battery_kwh * 250) / annual_kwh if annual_kwh > 0 else 0.0
    hp_boost = 0.08 if has_heat_pump else 0.0
    sc = base_sc + battery_boost + hp_boost

    cap = 0.90 if has_heat_pump else (0.75 if battery_kwh > 0 else 0.40)
    return round(min(sc, cap), 2)


def _compute_savings(
    annual_kwh: float,
    sc_rate: float,
    retail_price: float,
    has_heat_pump: bool,
    existing_heat_pump: bool,
) -> float:
    """Annual savings: self-consumed PV + feed-in revenue + heat pump savings."""
    self_consumed = annual_kwh * sc_rate
    exported = annual_kwh - self_consumed
    savings_pv = self_consumed * retail_price + exported * FEED_IN_TARIFF_EUR
    savings_hp = 0.0 if existing_heat_pump or not has_heat_pump else 1_200.0
    return round(savings_pv + savings_hp, 0)


def _extract_market_hints(bundle: EnrichmentBundle) -> dict:
    mc = bundle.market_context.data
    bp = mc.get("building_profile", {})
    return {
        "building_type": bp.get("building_type", ""),
        "estimated_era": bp.get("estimated_era", ""),
        "likely_heating": bp.get("likely_heating", "").lower(),
        "monument_protection": bp.get("monument_protection", bp.get("historic_preservation", "unlikely")).lower(),
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

    heating = hints["likely_heating"]
    has_heat_pump_already = "heat pump" in heating or "wärmepumpe" in heating
    building_type = hints["building_type"] or "residential building"
    solar_obligation = hints["has_solar_obligation"]
    energy_trend = hints["energy_trend"]

    monument = hints["monument_protection"]
    is_constrained = monument in ("likely", "possible", "yes")

    planes = _extract_roof_planes(bundle)
    total_roof_area = bundle.roof_analysis.data.get("total_roof_area_m2", 0)
    has_roof_data = planes is not None and len(planes) > 0

    if has_roof_data:
        high_planes = _select_planes(planes, {"high"})
        high_medium_planes = _select_planes(planes, {"high", "medium"})
        all_usable_planes = high_medium_planes

        starter_kwp, starter_kwh = _compute_yield(
            high_planes[:1] if high_planes else high_medium_planes[:1],
            annual_yield_per_kwp,
        )
        rec_kwp, rec_kwh = _compute_yield(high_medium_planes, annual_yield_per_kwp)
        prem_kwp, prem_kwh = _compute_yield(all_usable_planes, annual_yield_per_kwp)

        if starter_kwp < 2.0:
            starter_kwp, starter_kwh = rec_kwp * 0.5, rec_kwh * 0.5
        if rec_kwp < 3.0 and prem_kwp > 0:
            rec_kwp, rec_kwh = prem_kwp, prem_kwh
    else:
        starter_kwp = 4.0 if is_constrained else 5.0
        rec_kwp = 6.0 if is_constrained else 8.0
        prem_kwp = 8.0 if is_constrained else 10.0
        starter_kwh = starter_kwp * annual_yield_per_kwp
        rec_kwh = rec_kwp * annual_yield_per_kwp
        prem_kwh = prem_kwp * annual_yield_per_kwp

    starter_kwp, starter_kwh = _cap_system(starter_kwp, starter_kwh, MAX_STARTER_KWP)
    rec_kwp, rec_kwh = _cap_system(rec_kwp, rec_kwh, MAX_REC_KWP)
    prem_kwp, prem_kwh = _cap_system(prem_kwp, prem_kwh, MAX_PREM_KWP)

    rec_batt = _nearest_battery(rec_kwp * 1.2)
    prem_batt = _nearest_battery(prem_kwp * 1.5)

    sc_starter = _self_consumption_rate(starter_kwh, 0, False)
    sc_rec = _self_consumption_rate(rec_kwh, rec_batt, False)
    sc_prem = _self_consumption_rate(prem_kwh, prem_batt, not has_heat_pump_already)

    starter_savings = _compute_savings(starter_kwh, sc_starter, retail_price, False, False)
    rec_savings = _compute_savings(rec_kwh, sc_rec, retail_price, False, False)
    prem_savings = _compute_savings(prem_kwh, sc_prem, retail_price, not has_heat_pump_already, has_heat_pump_already)

    starter_capex = round(starter_kwp * PV_COST_PER_KWP)
    rec_capex = round(rec_kwp * PV_COST_PER_KWP + rec_batt * BATTERY_COST_PER_KWH)
    prem_capex = round(prem_kwp * PV_COST_PER_KWP + prem_batt * BATTERY_COST_PER_KWH + WALLBOX_COST)
    if not has_heat_pump_already:
        prem_capex += HEAT_PUMP_COST

    def _payback(capex: float, savings: float) -> float:
        return round(capex / savings, 1) if savings > 0 else 99.0

    def _roof_util(kwp: float) -> float:
        if total_roof_area <= 0:
            return 0.0
        used_area = kwp / 0.18
        return round(min(100.0, used_area / total_roof_area * 100), 0)

    starter_rationale = _build_rationale("starter", building_type, solar_obligation, is_constrained, energy_trend, heating, has_heat_pump_already)
    rec_rationale = _build_rationale("recommended", building_type, solar_obligation, is_constrained, energy_trend, heating, has_heat_pump_already)
    prem_rationale = _build_rationale("premium", building_type, solar_obligation, is_constrained, energy_trend, heating, has_heat_pump_already)

    offers = [
        Offer(
            tier=OfferTier.STARTER,
            label="Starter — Solar Only",
            rationale=starter_rationale,
            components=[
                OfferComponent(name="Solar PV", description=f"{starter_kwp:.1f} kWp rooftop PV", unit_cost_eur=round(starter_kwp * PV_COST_PER_KWP)),
            ],
            capex_eur=starter_capex,
            annual_savings_eur=starter_savings,
            payback_years=_payback(starter_capex, starter_savings),
            co2_saved_kg=round(starter_kwh * sc_starter * CO2_KG_PER_KWH_GRID),
            self_consumption_pct=round(sc_starter * 100),
            annual_production_kwh=round(starter_kwh),
            roof_utilization_pct=_roof_util(starter_kwp),
            system_kwp=starter_kwp,
            battery_kwh=0.0,
            retail_price_eur_kwh=retail_price,
            feed_in_tariff_eur=FEED_IN_TARIFF_EUR,
            has_heat_pump=False,
        ),
        Offer(
            tier=OfferTier.RECOMMENDED,
            label="Recommended — Solar + Battery",
            rationale=rec_rationale,
            components=[
                OfferComponent(name="Solar PV", description=f"{rec_kwp:.1f} kWp rooftop PV", unit_cost_eur=round(rec_kwp * PV_COST_PER_KWP)),
                OfferComponent(name="Battery", description=f"{rec_batt:.0f} kWh lithium-ion storage", unit_cost_eur=round(rec_batt * BATTERY_COST_PER_KWH)),
            ],
            capex_eur=rec_capex,
            annual_savings_eur=rec_savings,
            payback_years=_payback(rec_capex, rec_savings),
            co2_saved_kg=round(rec_kwh * sc_rec * CO2_KG_PER_KWH_GRID),
            self_consumption_pct=round(sc_rec * 100),
            annual_production_kwh=round(rec_kwh),
            roof_utilization_pct=_roof_util(rec_kwp),
            system_kwp=rec_kwp,
            battery_kwh=rec_batt,
            retail_price_eur_kwh=retail_price,
            feed_in_tariff_eur=FEED_IN_TARIFF_EUR,
            has_heat_pump=False,
        ),
        _build_premium(
            prem_kwp, prem_kwh, prem_batt, prem_capex, prem_savings,
            sc_prem, has_heat_pump_already, prem_rationale, total_roof_area,
            retail_price,
        ),
    ]

    return offers


def _build_premium(
    kwp: float, annual_kwh: float, battery_kwh: float, capex: float,
    savings: float, sc_rate: float, has_heat_pump: bool,
    rationale: str, total_roof_area: float,
    retail_price: float = 0.35,
) -> Offer:
    components = [
        OfferComponent(name="Solar PV", description=f"{kwp:.1f} kWp rooftop PV", unit_cost_eur=round(kwp * PV_COST_PER_KWP)),
        OfferComponent(name="Battery", description=f"{battery_kwh:.0f} kWh lithium-ion storage", unit_cost_eur=round(battery_kwh * BATTERY_COST_PER_KWH)),
    ]
    if not has_heat_pump:
        components.append(OfferComponent(name="Heat Pump", description="Air-source heat pump", unit_cost_eur=HEAT_PUMP_COST))
    components.append(OfferComponent(name="Wallbox", description="11 kW EV charging station", unit_cost_eur=WALLBOX_COST))

    co2_base = annual_kwh * sc_rate + (3000 if not has_heat_pump else 0)
    payback = round(capex / savings, 1) if savings > 0 else 99.0

    used_area = kwp / 0.18
    roof_util = round(min(100.0, used_area / total_roof_area * 100), 0) if total_roof_area > 0 else 0.0

    return Offer(
        tier=OfferTier.PREMIUM,
        label="Premium — Full Energy Package",
        rationale=rationale,
        components=components,
        capex_eur=capex,
        annual_savings_eur=savings,
        payback_years=payback,
        co2_saved_kg=round(co2_base * CO2_KG_PER_KWH_GRID),
        self_consumption_pct=round(sc_rate * 100),
        annual_production_kwh=round(annual_kwh),
        roof_utilization_pct=roof_util,
        system_kwp=kwp,
        battery_kwh=battery_kwh,
        retail_price_eur_kwh=retail_price,
        feed_in_tariff_eur=FEED_IN_TARIFF_EUR,
        has_heat_pump=not has_heat_pump,
    )


def _build_rationale(
    tier: str, building_type: str, solar_obligation: bool, constrained: bool,
    energy_trend: str, heating: str, has_hp: bool,
) -> str:
    if tier == "starter":
        parts = [f"Entry-level solar for your {building_type}, using the best roof plane only"]
        if solar_obligation:
            parts.append("meets Solarpflicht requirements")
        if constrained:
            parts.append("sized for potential heritage restrictions")
    elif tier == "recommended":
        parts = [f"Best value for your {building_type} — all suitable roof planes plus battery storage"]
        if energy_trend == "rising":
            parts.append("locks in savings against rising prices")
        if constrained:
            parts.append("adapted to building constraints")
    else:
        if has_hp:
            parts = [f"Full energy package for your {building_type}, wallbox added (heat pump already present)"]
        elif "gas" in heating or "öl" in heating or "oil" in heating:
            parts = [f"Complete energy transition replacing {heating} with heat pump"]
        else:
            parts = [f"Maximum independence: solar + battery + heat pump + wallbox"]
        if constrained:
            parts.append("adjusted for heritage building considerations")
    return " — ".join(parts) + "."
