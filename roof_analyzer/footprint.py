"""Schritt 5: Gebäude-Footprint via Google Solar API laden (ohne OSM).

Vorher haben wir hier die Overpass-API von OpenStreetMap benutzt, um den
Footprint des Zielgebäudes zu holen. Das war aus zwei Gründen schlecht:

1. Die Overpass-Mirror-Infrastruktur ist unzuverlässig — Requests laufen
   regelmäßig in Timeouts (wie im Produktionslog gesehen), was den gesamten
   Roof-Analyzer auf einen 18x18-m-Quadrat-Fallback zurückfallen lässt.
2. Die Anforderung ist, dass der Roof-Analyzer ausschließlich Google-Cloud-
   APIs benutzt (gleiche Plattform wie der Rest des Projekts).

Wir verwenden jetzt die **Google Solar API** (`buildingInsights:findClosest`),
die für die Zieladresse direkt eine Bounding-Box des Gebäudes sowie
Roof-Segmente zurückliefert. Für unsere Zwecke (Mesh-Clipping) ist die
Bounding-Box des Gebäudes völlig ausreichend — sie schneidet Nachbarhäuser
genauso zuverlässig weg wie der alte OSM-Footprint.

Wenn die Solar API das Gebäude nicht kennt (z.B. außerhalb der aktuellen
Coverage), geben wir ``None`` zurück, damit ``main.py`` den bestehenden
18x18-m-Fallback benutzen kann — genauso wie bisher bei OSM-Ausfällen.
"""
from __future__ import annotations

import time
from typing import Optional

import numpy as np
import requests
from shapely.geometry import Polygon

from .coords import lla_to_ecef, ecef_to_enu

SOLAR_ENDPOINT = "https://solar.googleapis.com/v1/buildingInsights:findClosest"


def _bbox_to_polygon(bbox: dict) -> Optional[Polygon]:
    """Google Solar API BoundingBox -> shapely Polygon (lon, lat)."""
    sw = bbox.get("sw") or {}
    ne = bbox.get("ne") or {}
    try:
        south = float(sw["latitude"])
        west = float(sw["longitude"])
        north = float(ne["latitude"])
        east = float(ne["longitude"])
    except (KeyError, TypeError, ValueError):
        return None
    # shapely uses (x=lon, y=lat)
    poly = Polygon([(west, south), (east, south), (east, north), (west, north)])
    if not poly.is_valid:
        return None
    return poly


def fetch_building_footprint(
    lat: float,
    lon: float,
    api_key: str | None = None,
    search_radius: int = 30,  # kept for backwards compatibility with callers
) -> Polygon | None:
    """Findet das Gebaeude, das (lat,lon) enthaelt, via Google Solar API.

    Parameters
    ----------
    lat, lon : float
        Zielkoordinaten (WGS84).
    api_key : str | None
        Google Maps / Solar API key. Wenn ``None``, wird ``GOOGLE_MAPS_API_KEY``
        aus der Umgebung gelesen.
    search_radius : int
        Nicht mehr benutzt (historisch für den Overpass-Aufruf). Wir lassen
        den Parameter aus Kompatibilitaetsgruenden stehen, ignorieren ihn
        aber — die Solar API findet automatisch das nächstgelegene Gebäude.
    """
    import os

    key = (api_key or "").strip() or os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        print("      [warn] Kein GOOGLE_MAPS_API_KEY gesetzt - Solar-API nicht aufrufbar.")
        return None

    params = {
        "location.latitude": f"{lat:.7f}",
        "location.longitude": f"{lon:.7f}",
        "requiredQuality": "HIGH",
        "key": key,
    }

    data = None
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            r = requests.get(SOLAR_ENDPOINT, params=params, timeout=20)
        except Exception as e:
            last_err = e
            time.sleep(1.0)
            continue

        if r.status_code == 200:
            try:
                data = r.json()
            except ValueError as e:
                last_err = e
                continue
            break

        # 404 = Solar API hat kein Gebäude dort. Kein Retry, direkt Fallback.
        if r.status_code == 404:
            print("      [warn] Solar API hat das Gebäude nicht gefunden (404).")
            return None

        # Wenn HIGH-Qualität nicht verfügbar, einmalig auf MEDIUM herabstufen.
        if r.status_code in (400, 422) and params.get("requiredQuality") == "HIGH":
            print("      [info] Solar API HIGH nicht verfügbar - versuche MEDIUM.")
            params["requiredQuality"] = "MEDIUM"
            continue

        last_err = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        time.sleep(1.0)

    if data is None:
        print(f"      [warn] Solar-API-Aufruf fehlgeschlagen: {last_err}")
        return None

    bbox = data.get("boundingBox")
    if not isinstance(bbox, dict):
        print("      [warn] Solar-API-Antwort enthält keine boundingBox.")
        return None

    poly = _bbox_to_polygon(bbox)
    if poly is None:
        print("      [warn] Solar-API boundingBox konnte nicht geparst werden.")
        return None

    return poly


def footprint_to_enu(poly: Polygon, origin_lat: float, origin_lon: float) -> Polygon:
    pts_lla = list(poly.exterior.coords)
    pts_ecef = np.array([lla_to_ecef(lon, lat, 0.0) for lon, lat in pts_lla])
    enu = ecef_to_enu(pts_ecef, origin_lat, origin_lon)
    return Polygon(enu[:, :2])
