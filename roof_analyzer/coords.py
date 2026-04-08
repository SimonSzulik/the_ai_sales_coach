"""ECEF <-> ENU Konvertierung. Entscheidend, sonst sind alle Tilt/Azimuth-Werte falsch."""
from __future__ import annotations
import numpy as np
from pyproj import Transformer

# Google 3D Tiles liefert Vertices in ECEF (EPSG:4978).
# Wir transformieren in ein lokales East-North-Up System mit Ursprung an der Adresse.

_ecef_from_lla = Transformer.from_crs("EPSG:4326", "EPSG:4978", always_xy=True)


def lla_to_ecef(lon_deg: float, lat_deg: float, h: float = 0.0) -> np.ndarray:
    x, y, z = _ecef_from_lla.transform(lon_deg, lat_deg, h)
    return np.array([x, y, z], dtype=np.float64)


def enu_rotation(lat_deg: float, lon_deg: float) -> np.ndarray:
    """Rotationsmatrix ECEF -> ENU am gegebenen Punkt."""
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    sl, cl = np.sin(lat), np.cos(lat)
    so, co = np.sin(lon), np.cos(lon)
    return np.array([
        [-so,            co,           0.0],   # East
        [-sl * co,      -sl * so,      cl ],   # North
        [ cl * co,       cl * so,      sl ],   # Up
    ])


def ecef_to_enu(points_ecef: np.ndarray, origin_lat: float, origin_lon: float) -> np.ndarray:
    """Wandelt (N,3)-Array von ECEF-Koordinaten in lokales ENU um."""
    origin = lla_to_ecef(origin_lon, origin_lat, 0.0)
    R = enu_rotation(origin_lat, origin_lon)
    delta = points_ecef - origin
    return delta @ R.T
