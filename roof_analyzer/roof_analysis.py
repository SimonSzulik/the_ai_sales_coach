"""Schritt 6+7: Dachflächen klassifizieren, clustern und vermessen."""
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import List
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point
from sklearn.cluster import DBSCAN

from .coords import ecef_to_enu


@dataclass
class RoofPlane:
    cluster_id: int
    area_m2: float
    tilt_deg: float        # 0 = flach, 90 = vertikal
    azimuth_deg: float     # 0 = Nord, 90 = Ost, 180 = Süd, 270 = West
    suitability: str       # "high" | "medium" | "low"
    estimated_kwp: float
    triangle_count: int


# ---- Mesh in ENU bringen + auf Footprint clippen ----

def mesh_to_enu(mesh: trimesh.Trimesh, origin_lat: float, origin_lon: float) -> trimesh.Trimesh:
    enu_verts = ecef_to_enu(np.asarray(mesh.vertices), origin_lat, origin_lon)
    out = mesh.copy()
    out.vertices = enu_verts
    return out


def filter_by_footprint(mesh: trimesh.Trimesh, footprint_enu: Polygon, margin: float = 1.0) -> trimesh.Trimesh:
    """Behält nur Dreiecke, deren Centroid im Footprint (mit Margin) liegt."""
    centroids = mesh.triangles_center
    poly = footprint_enu.buffer(margin)
    mask = np.array([poly.contains(Point(c[0], c[1])) for c in centroids])
    if mask.sum() == 0:
        return mesh.submesh([np.arange(len(mesh.faces))], append=True)
    return mesh.submesh([np.where(mask)[0]], append=True)


# ---- Klassifikation ----

def _normals_and_areas(mesh: trimesh.Trimesh):
    n = mesh.face_normals.copy()
    # Konsistente Orientierung: nach oben (positives Up). Wenn Centroid eher tief
    # und Normale nach unten zeigt, flippen wir.
    flip = n[:, 2] < 0
    n[flip] *= -1
    return n, mesh.area_faces


def classify_roof(mesh: trimesh.Trimesh, min_height: float = 2.0) -> tuple[trimesh.Trimesh, np.ndarray, np.ndarray]:
    """Filtert Bodendreiecke und Wände raus.
    Rückgabe: roof_mesh, normals, areas.
    """
    centroids = mesh.triangles_center
    normals, areas = _normals_and_areas(mesh)

    # Wand-Filter: Up-Komponente muss > cos(60°) sein
    is_upward = normals[:, 2] > 0.5
    # Boden-Filter: Höhe über lokalem Boden
    z_floor = np.percentile(centroids[:, 2], 5)
    above_ground = centroids[:, 2] > (z_floor + min_height)

    keep = is_upward & above_ground
    if keep.sum() == 0:
        raise RuntimeError("Keine Dachflächen klassifizierbar — Mesh prüfen.")

    roof = mesh.submesh([np.where(keep)[0]], append=True)
    return roof, normals[keep], areas[keep]


# ---- Clustering einzelner Dachflächen ----

def cluster_planes(normals: np.ndarray, mesh_centroids: np.ndarray, eps: float = 0.12) -> np.ndarray:
    """Clustert Dreiecke nach (Normalen-Richtung + Höhe). min_samples und eps werden
    adaptiv an die Mesh-Größe angepasst, damit sparse/laendliche Meshes nicht komplett
    als Noise (-1) enden.

    Fallback: Wenn DBSCAN alles als Noise markiert und nur wenige Dreiecke da sind,
    behandeln wir alle als einen einzigen Cluster (eine Dachflaeche).
    """
    n = len(normals)
    if n == 0:
        return np.array([], dtype=int)
    # Sparse meshes brauchen groessere eps, weil per-Triangle-Normalen in
    # niedrig aufgeloesten Google-Tiles stark streuen
    if n < 30:
        eps = max(eps, 0.35)
        min_samples = 2
    elif n < 100:
        min_samples = 3
    else:
        min_samples = 5
    feats = np.hstack([normals, mesh_centroids[:, 2:3] * 0.05])
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(feats)
    labels = db.labels_

    # Fallback 1: Alles Noise -> retry mit sehr grossem eps
    if (labels == -1).all() and n > 0:
        db2 = DBSCAN(eps=0.6, min_samples=2).fit(feats)
        labels = db2.labels_

    # Fallback 2: Immer noch alles Noise -> alle in einen Cluster
    if (labels == -1).all() and n > 0:
        labels = np.zeros(n, dtype=int)

    return labels


# ---- Tilt / Azimuth ----

def normal_to_tilt_azimuth(n: np.ndarray) -> tuple[float, float]:
    n = n / (np.linalg.norm(n) + 1e-12)
    tilt = float(np.degrees(np.arccos(np.clip(n[2], -1, 1))))
    # Azimuth: 0=N, 90=E, 180=S, 270=W (ENU: x=East, y=North)
    az = float((np.degrees(np.arctan2(n[0], n[1])) + 360.0) % 360.0)
    return tilt, az


def _suitability(tilt: float, az: float, area: float) -> str:
    south_offset = abs(((az - 180) + 180) % 360 - 180)  # 0 = perfekt Süd
    if area < 6:
        return "low"
    if 15 <= tilt <= 55 and south_offset <= 60:
        return "high"
    if tilt < 10 and area >= 12:        # Flachdach -> Aufständerung
        return "high"
    if south_offset <= 110 and area >= 8:
        return "medium"
    return "low"


def summarize_planes(roof_mesh: trimesh.Trimesh, normals: np.ndarray, areas: np.ndarray) -> List[RoofPlane]:
    centroids = roof_mesh.triangles_center
    labels = cluster_planes(normals, centroids)
    planes: List[RoofPlane] = []
    n_total = len(labels)
    # Sehr kleine Meshes: jeden Cluster akzeptieren, auch mit 1 Dreieck
    min_cluster = 1 if n_total < 30 else (3 if n_total < 100 else 5)
    for cid in sorted(set(labels)):
        if cid == -1:
            continue
        idx = np.where(labels == cid)[0]
        if len(idx) < min_cluster:
            continue
        # Flächen-gewichteter Mittel-Normalvektor
        w = areas[idx]
        n_mean = np.average(normals[idx], axis=0, weights=w)
        tilt, az = normal_to_tilt_azimuth(n_mean)
        total_area = float(w.sum())
        kwp = round(total_area * 0.18, 2)  # Faustregel ~180 W/m²
        planes.append(RoofPlane(
            cluster_id=int(cid),
            area_m2=round(total_area, 2),
            tilt_deg=round(tilt, 1),
            azimuth_deg=round(az, 1),
            suitability=_suitability(tilt, az, total_area),
            estimated_kwp=kwp,
            triangle_count=int(len(idx)),
        ))
    planes.sort(key=lambda p: (-p.area_m2))
    return planes
