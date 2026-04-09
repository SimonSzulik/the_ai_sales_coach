"""Solar potential enricher using EU PVGIS API."""

from __future__ import annotations

import logging

import httpx

from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"

# Mid-Germany latitude for fallbacks when coordinates are missing (same kWh/kWp default context).
_GERMANY_REF_LAT = 51.0


def _reference_fixed_tilt_deg(latitude: float) -> float:
    """Rule-of-thumb optimum tilt for fixed annual yield (northern mid-latitudes): ~latitude, capped."""
    return round(min(abs(latitude), 60.0), 1)


def _reference_azimuth_south_pvgis() -> float:
    """PVGIS convention: 0° = south, 90° = west (northern hemisphere)."""
    return 0.0


def _solar_reference_angles(lat: float | None) -> tuple[float, float]:
    lat_ref = lat if lat is not None else _GERMANY_REF_LAT
    return _reference_fixed_tilt_deg(lat_ref), _reference_azimuth_south_pvgis()


async def enrich_solar(lat: float | None, lon: float | None) -> EnrichmentResult:
    ref_tilt, ref_az = _solar_reference_angles(lat)
    if lat is None or lon is None:
        return EnrichmentResult(
            source="pvgis",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={
                "annual_kwh_per_kwp": 950.0,
                "optimal_angle": ref_tilt,
                "optimal_azimuth": ref_az,
                "note": "Using German average (no coordinates)",
            },
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                PVGIS_URL,
                params={
                    "lat": lat,
                    "lon": lon,
                    "peakpower": 1,       # 1 kWp reference
                    "loss": 14,           # standard system losses %
                    "outputformat": "json",
                    "pvtechchoice": "crystSi",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        outputs = data.get("outputs", {})
        totals = outputs.get("totals", {}).get("fixed", {})
        monthly = outputs.get("monthly", {}).get("fixed", [])

        annual_kwh = totals.get("E_y", 0.0)
        # Do not use inputs.mounting_system.fixed — those echo request defaults (often 0°), not optima.
        opt_angle, opt_azimuth = _solar_reference_angles(lat)
        monthly_kwh = [m.get("E_m", 0.0) for m in monthly] if monthly else []

        return EnrichmentResult(
            source="pvgis",
            confidence=Confidence.HIGH if annual_kwh > 0 else Confidence.LOW,
            data={
                "annual_kwh_per_kwp": round(annual_kwh, 1),
                "optimal_angle": opt_angle,
                "optimal_azimuth": opt_azimuth,
                "monthly_kwh": [round(v, 1) for v in monthly_kwh],
            },
        )
    except Exception as exc:
        logger.exception("PVGIS request failed")
        ft, fa = _solar_reference_angles(lat)
        return EnrichmentResult(
            source="pvgis",
            confidence=Confidence.LOW,
            fallback_used=True,
            error=str(exc),
            data={
                "annual_kwh_per_kwp": 950.0,
                "optimal_angle": ft,
                "optimal_azimuth": fa,
                "note": "Using German average (API error)",
            },
        )
