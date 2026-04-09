import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import (
    DEFAULT_ANNUAL_ELECTRICITY_KWH,
    BriefingResponse,
    LeadCreate,
    LeadResponse,
    LeadRow,
    RecomputeOffersBody,
)
from app.pipeline import recompute_offers_only, run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/lead", response_model=LeadResponse, status_code=201)
async def create_lead(
    payload: LeadCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    row = LeadRow(
        name=payload.name,
        address=payload.address,
        zip_code=payload.zip_code,
        product_interest=payload.product_interest,
        annual_electricity_kwh=payload.annual_electricity_kwh
        if payload.annual_electricity_kwh is not None
        else DEFAULT_ANNUAL_ELECTRICITY_KWH,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    background.add_task(run_pipeline, row.id)

    return row


@router.get("/lead/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(LeadRow, lead_id)
    if not row:
        raise HTTPException(404, "Lead not found")
    return row


@router.post("/lead/{lead_id}/recompute-offers", response_model=BriefingResponse)
async def recompute_offers(lead_id: str, body: RecomputeOffersBody):
    """Rebuild offers from stored enrichment using the given annual electricity usage (kWh/yr)."""
    result = await recompute_offers_only(lead_id, body.annual_electricity_kwh)
    if result is None:
        raise HTTPException(
            400,
            detail="Lead not found, not ready, or missing enrichment data for recomputation.",
        )
    return result


@router.get("/lead/{lead_id}/briefing", response_model=BriefingResponse)
async def get_briefing(lead_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(LeadRow, lead_id)
    if not row:
        raise HTTPException(404, "Lead not found")
    if row.status in ("pending", "processing"):
        return JSONResponse(status_code=202, content={"status": "processing"})
    if row.status == "error":
        raise HTTPException(500, detail="Pipeline failed")
    return BriefingResponse(**row.briefing_data)


@router.get("/leads", response_model=list[LeadResponse])
async def list_leads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeadRow).order_by(LeadRow.created_at.desc()).limit(50))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Google Maps proxy endpoints
#
# We proxy address validation and map-embed URL generation through the backend
# so the Google Maps API key (already used by the roof analyzer) is never
# shipped to the browser in source. The same key handles Geocoding + Maps
# Embed API on the Google Cloud project.
# ---------------------------------------------------------------------------


@router.get("/maps/validate-address")
async def maps_validate_address(
    address: str = Query(..., min_length=1, max_length=500),
    zip_code: str = Query(..., min_length=1, max_length=10),
):
    """Validate an address using the Google Geocoding API.

    Returns `{ valid: bool, latitude?, longitude?, formatted_address? }`.
    An address is considered valid if Google returns at least one result whose
    returned postal code (strip whitespace, case-insensitive) matches the one
    the user typed and that has a street-level component (route / premise /
    street_address).
    """
    settings = get_settings()
    key = settings.google_maps_api_key
    if not key:
        logger.warning("GOOGLE_MAPS_API_KEY not set — cannot validate address")
        raise HTTPException(503, detail="Google Maps API key is not configured on the server.")

    wanted_zip = zip_code.replace(" ", "").lower()
    params = {
        "address": f"{address}, {zip_code}",
        "key": key,
        "language": "en",
        "region": "de",
    }
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{urlencode(params)}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
    except httpx.HTTPError as exc:
        logger.warning("Google Geocoding request failed: %s", exc)
        return {"valid": False, "error": "geocoding_unreachable"}

    if resp.status_code != 200:
        logger.warning("Google Geocoding returned HTTP %s", resp.status_code)
        return {"valid": False, "error": f"http_{resp.status_code}"}

    payload = resp.json()
    status = payload.get("status")
    if status != "OK":
        # ZERO_RESULTS is the expected "not found" case; everything else is
        # logged but still reported as "not valid" to the frontend.
        if status != "ZERO_RESULTS":
            logger.warning("Google Geocoding status=%s error=%s", status, payload.get("error_message"))
        return {"valid": False, "error": status or "unknown"}

    results = payload.get("results") or []
    street_types = {"route", "premise", "street_address", "subpremise"}

    for r in results:
        components = r.get("address_components") or []
        got_zip = ""
        has_street = False
        for comp in components:
            types = comp.get("types") or []
            if "postal_code" in types:
                got_zip = (comp.get("long_name") or "").replace(" ", "").lower()
            if street_types.intersection(types):
                has_street = True
        if not has_street:
            types = r.get("types") or []
            if street_types.intersection(types):
                has_street = True
        if not has_street:
            continue
        if not got_zip or got_zip != wanted_zip:
            continue

        geometry = (r.get("geometry") or {}).get("location") or {}
        return {
            "valid": True,
            "latitude": geometry.get("lat"),
            "longitude": geometry.get("lng"),
            "formatted_address": r.get("formatted_address"),
        }

    return {"valid": False, "error": "no_matching_result"}


@router.get("/maps/embed-url")
async def maps_embed_url(
    lat: float = Query(...),
    lng: float = Query(...),
    zoom: int = Query(18, ge=1, le=21),
    maptype: str = Query("satellite", pattern="^(roadmap|satellite|hybrid|terrain)$"),
    mode: str = Query("view", pattern="^(view|place)$"),
):
    """Return a pre-signed Google Maps Embed API URL for an iframe.

    `mode=view` renders a plain map with no marker (Embed API's `view` endpoint).
    `mode=place` renders a map with a pin at the given coordinates (Embed API's
    `place` endpoint, which requires a `q` query).

    The key is kept server-side; the returned URL is opaque from the frontend's
    perspective (though browsers will see the key in the Network tab — this is
    unavoidable with the Maps Embed API and should be mitigated with HTTP
    referrer restrictions in Google Cloud Console).
    """
    settings = get_settings()
    key = settings.google_maps_api_key
    if not key:
        raise HTTPException(503, detail="Google Maps API key is not configured on the server.")

    if mode == "place":
        params = {
            "key": key,
            "q": f"{lat},{lng}",
            "zoom": zoom,
            "maptype": maptype,
        }
        url = f"https://www.google.com/maps/embed/v1/place?{urlencode(params)}"
    else:
        params = {
            "key": key,
            "center": f"{lat},{lng}",
            "zoom": zoom,
            "maptype": maptype,
        }
        url = f"https://www.google.com/maps/embed/v1/view?{urlencode(params)}"
    return {"url": url}
