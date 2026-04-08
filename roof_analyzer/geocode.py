"""Schritt 2: Adresse -> Lat/Lon via Google Geocoding API."""
from __future__ import annotations
import requests
from dataclasses import dataclass


@dataclass
class GeocodeResult:
    lat: float
    lon: float
    formatted: str
    location_type: str  # ROOFTOP / RANGE_INTERPOLATED / GEOMETRIC_CENTER / APPROXIMATE

    @property
    def is_precise(self) -> bool:
        return self.location_type in ("ROOFTOP", "RANGE_INTERPOLATED")


def geocode(address: str, api_key: str) -> GeocodeResult:
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    r = requests.get(url, params={"address": address, "key": api_key}, timeout=15)
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "OK" or not data.get("results"):
        raise ValueError(f"Geocoding fehlgeschlagen: {data.get('status')}")
    top = data["results"][0]
    loc = top["geometry"]["location"]
    return GeocodeResult(
        lat=loc["lat"],
        lon=loc["lng"],
        formatted=top["formatted_address"],
        location_type=top["geometry"]["location_type"],
    )
