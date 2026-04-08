"""Solar potential enricher using EU PVGIS API."""

from __future__ import annotations

import logging

import httpx

from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"


async def enrich_solar(lat: float | None, lon: float | None) -> EnrichmentResult:
    if lat is None or lon is None:
        return EnrichmentResult(
            source="pvgis",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={"annual_kwh_per_kwp": 950.0, "note": "Using German average (no coordinates)"},
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
        opt_angle = data.get("inputs", {}).get("mounting_system", {}).get("fixed", {}).get("slope", {}).get("value", 0)
        opt_azimuth = data.get("inputs", {}).get("mounting_system", {}).get("fixed", {}).get("azimuth", {}).get("value", 0)
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
        return EnrichmentResult(
            source="pvgis",
            confidence=Confidence.LOW,
            fallback_used=True,
            error=str(exc),
            data={"annual_kwh_per_kwp": 950.0, "note": "Using German average (API error)"},
        )
