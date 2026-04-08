"""Roof analysis enricher — runs the roof_analyzer pipeline per lead."""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from app.config import get_settings
from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

ROOF_OUTPUTS_DIR = Path(__file__).resolve().parent.parent.parent / "roof_outputs"


def _run_analysis(address: str, zip_code: str, lead_id: str) -> dict:
    """Synchronous wrapper — executed in a thread."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
    from roof_analyzer.main import analyze_address

    settings = get_settings()
    api_key = settings.google_maps_api_key

    full_address = f"{address}, {zip_code}, Germany"
    out_dir = str(ROOF_OUTPUTS_DIR / lead_id)
    os.makedirs(out_dir, exist_ok=True)

    result = analyze_address(full_address, api_key, out_dir=out_dir)

    result.pop("preview", None)
    result.pop("preview_3d", None)
    result.pop("compare_maps", None)

    return result


async def enrich_roof(address: str, zip_code: str, lead_id: str) -> EnrichmentResult:
    settings = get_settings()
    if not settings.google_maps_api_key:
        logger.warning("GOOGLE_MAPS_API_KEY not set — skipping roof analysis")
        return EnrichmentResult(
            source="roof_analyzer",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={"error": "GOOGLE_MAPS_API_KEY not configured"},
        )

    try:
        data = await asyncio.to_thread(_run_analysis, address, zip_code, lead_id)
        return EnrichmentResult(
            source="roof_analyzer",
            confidence=Confidence.HIGH,
            data=data,
        )
    except Exception as exc:
        logger.exception("Roof analysis failed for lead %s", lead_id)
        return EnrichmentResult(
            source="roof_analyzer",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={"error": str(exc)},
        )
