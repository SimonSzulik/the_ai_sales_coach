"""Energy price enricher using SMARD API (Bundesnetzagentur)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

SMARD_URL = "https://www.smard.de/app/chart_data/4169/DE/4169_DE_hour_"


async def enrich_energy() -> EnrichmentResult:
    """Fetch recent wholesale electricity prices from SMARD.

    Falls back to a realistic static value if the API is unavailable, which
    is common due to the quirky SMARD timestamp-based URL scheme.
    """
    try:
        now = datetime.now(timezone.utc)
        week_start = now.timestamp() * 1000
        # SMARD expects a specific Monday-midnight timestamp; we try the most
        # recent Monday but accept failure gracefully.
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.smard.de/app/chart_data/4169/DE/index_hour.json",
                headers={"User-Agent": "AISalesCoach-Hackathon/0.1"},
            )
            resp.raise_for_status()
            timestamps = resp.json().get("timestamps", [])

        if timestamps:
            latest_ts = timestamps[-1]
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{SMARD_URL}{latest_ts}.json",
                    headers={"User-Agent": "AISalesCoach-Hackathon/0.1"},
                )
                resp.raise_for_status()
                series = resp.json().get("series", [])

            prices = [p[1] for p in series if p[1] is not None]
            if prices:
                avg_wholesale_mwh = sum(prices) / len(prices)
                avg_wholesale_kwh = avg_wholesale_mwh / 1000  # EUR/MWh -> EUR/kWh
                retail = 0.15 + avg_wholesale_kwh  # grid fees, taxes, margin ~15 ct/kWh
                return EnrichmentResult(
                    source="smard",
                    confidence=Confidence.HIGH,
                    data={
                        "wholesale_price_eur_mwh": round(avg_wholesale_mwh, 2),
                        "retail_price_eur_kwh": round(retail, 4),
                        "price_trend": "elevated" if avg_wholesale_kwh > 0.08 else "moderate",
                        "data_points": len(prices),
                    },
                )

        return _fallback("No price data in SMARD response")
    except Exception as exc:
        logger.warning("SMARD API unavailable, using fallback: %s", exc)
        return _fallback(str(exc))


def _fallback(reason: str) -> EnrichmentResult:
    return EnrichmentResult(
        source="smard_fallback",
        confidence=Confidence.MEDIUM,
        fallback_used=True,
        data={
            "wholesale_price_eur_mwh": 85.0,
            "retail_price_eur_kwh": 0.35,
            "price_trend": "elevated",
            "note": f"Static fallback: {reason}",
        },
    )
