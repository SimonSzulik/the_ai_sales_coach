"""Schritt 5: Gebäude-Footprint von OSM laden (Overpass API) und in lokales ENU bringen."""
from __future__ import annotations
import time
import requests
import numpy as np
from shapely.geometry import Polygon, Point
from .coords import lla_to_ecef, ecef_to_enu

# Mehrere Overpass-Mirrors - falls einer 504 wirft, fallback auf naechsten
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]


def fetch_building_footprint(lat: float, lon: float, search_radius: int = 30) -> Polygon | None:
    """Findet das Gebaeude, das (lat,lon) enthaelt oder am naechsten liegt.
    Versucht mehrere Overpass-Mirrors mit Retry. Gibt None zurueck wenn alle fehlschlagen."""
    query = f"""
    [out:json][timeout:25];
    (
      way(around:{search_radius},{lat},{lon})["building"];
      relation(around:{search_radius},{lat},{lon})["building"];
    );
    out geom;
    """
    data = None
    last_err: Exception | None = None
    for url in OVERPASS_MIRRORS:
        for attempt in range(2):
            try:
                r = requests.post(url, data={"data": query}, timeout=30)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:
                last_err = e
                time.sleep(1.5)
        if data is not None:
            break
    if data is None:
        print(f"      [warn] Alle Overpass-Mirrors fehlgeschlagen: {last_err}")
        return None
    target = Point(lon, lat)
    polygons: list[tuple[float, Polygon]] = []
    for el in data.get("elements", []):
        if el["type"] == "way" and "geometry" in el:
            coords = [(p["lon"], p["lat"]) for p in el["geometry"]]
            if len(coords) >= 4:
                poly = Polygon(coords)
                if poly.is_valid:
                    polygons.append((poly.distance(target), poly))
    if not polygons:
        return None
    polygons.sort(key=lambda t: t[0])
    return polygons[0][1]


def footprint_to_enu(poly: Polygon, origin_lat: float, origin_lon: float) -> Polygon:
    pts_lla = list(poly.exterior.coords)
    pts_ecef = np.array([lla_to_ecef(lon, lat, 0.0) for lon, lat in pts_lla])
    enu = ecef_to_enu(pts_ecef, origin_lat, origin_lon)
    return Polygon(enu[:, :2])
