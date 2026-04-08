"""Geocoding enricher using Nominatim (OpenStreetMap)."""

from __future__ import annotations

import logging

import httpx

from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def enrich_geo(address: str, zip_code: str) -> EnrichmentResult:
    query = f"{address}, {zip_code}, Germany"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 1,
                },
                headers={"User-Agent": "AISalesCoach-Hackathon/0.1"},
            )
            resp.raise_for_status()
            results = resp.json()

        if not results:
            return EnrichmentResult(
                source="nominatim",
                confidence=Confidence.LOW,
                fallback_used=True,
                data={"error": "No results found"},
            )

        hit = results[0]
        addr = hit.get("address", {})
        return EnrichmentResult(
            source="nominatim",
            confidence=Confidence.HIGH,
            data={
                "latitude": float(hit["lat"]),
                "longitude": float(hit["lon"]),
                "display_name": hit.get("display_name", ""),
                "building_type": hit.get("type", "unknown"),
                "city": addr.get("city") or addr.get("town") or addr.get("village", ""),
                "state": addr.get("state", ""),
                "country": addr.get("country", "Germany"),
            },
        )
    except Exception as exc:
        logger.exception("Geocoding failed")
        return EnrichmentResult(
            source="nominatim",
            confidence=Confidence.NONE,
            error=str(exc),
            data={},
        )
