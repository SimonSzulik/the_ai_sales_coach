"""Schritt 3: Photorealistic 3D Tiles -> Mesh bei einer Adresse.

Robustere Implementierung mit:
- Korrekter Box-/Region-/Sphere-BoundingVolume-Containment
- Globaler Session-Token-Propagation
- DFS bis zu Leaves mit glb-Content
- Verbose Logging (ROOF_VERBOSE=1)
"""
from __future__ import annotations
import io
import os
import urllib.parse as up
from dataclasses import dataclass
from typing import Optional

import numpy as np
import requests
import trimesh

from .coords import lla_to_ecef

ROOT_URL = "https://tile.googleapis.com/v1/3dtiles/root.json"
SESSION = requests.Session()
VERBOSE = os.environ.get("ROOF_VERBOSE", "0") == "1"


def _log(msg: str) -> None:
    if VERBOSE:
        print(f"  [tiles] {msg}")


@dataclass
class TileFetchConfig:
    api_key: str
    target_lat: float
    target_lon: float
    radius_m: float = 40.0
    max_geometric_error: float = 10.0   # feiner = detailierter, typ. 5-15 fuer Hausdetail
    max_tiles: int = 400                # hartes Budget fuer Tile-Requests
    max_glb: int = 30                   # max. GLB-Dateien zu mergen


# ---------- BoundingVolume Containment ----------

def _region_contains(region, lat_rad: float, lon_rad: float) -> bool:
    west, south, east, north, *_ = region
    return south <= lat_rad <= north and west <= lon_rad <= east


def _box_contains(box, target_ecef: np.ndarray, margin: float = 30.0) -> bool:
    """3D Tiles box: [cx,cy,cz, ux,uy,uz, vx,vy,vz, wx,wy,wz] in ECEF.
    u/v/w sind HALB-Achsen-Vektoren der OBB."""
    c = np.array(box[0:3], dtype=np.float64)
    u = np.array(box[3:6], dtype=np.float64)
    v = np.array(box[6:9], dtype=np.float64)
    w = np.array(box[9:12], dtype=np.float64)
    d = target_ecef - c
    for axis in (u, v, w):
        length2 = float(np.dot(axis, axis))
        if length2 < 1e-9:
            continue
        proj = float(np.dot(d, axis))
        if abs(proj) > length2 + margin * np.sqrt(length2):
            return False
    return True


def _sphere_contains(sphere, target_ecef: np.ndarray, margin: float = 30.0) -> bool:
    c = np.array(sphere[0:3], dtype=np.float64)
    r = float(sphere[3])
    return float(np.linalg.norm(target_ecef - c)) <= r + margin


def _bv_contains(bv: dict, target_ecef_candidates: list, lat: float, lon: float, margin: float = 30.0) -> bool:
    """Akzeptiert ein Tile, wenn IRGENDEINER der Hoehen-Kandidaten drin liegt.
    Vermeidet falsche Rejects wegen Elevation-Mismatch (Stuttgart ~250m)."""
    if not bv:
        return True
    if "region" in bv:
        return _region_contains(bv["region"], np.radians(lat), np.radians(lon))
    if "box" in bv:
        return any(_box_contains(bv["box"], p, margin=margin) for p in target_ecef_candidates)
    if "sphere" in bv:
        return any(_sphere_contains(bv["sphere"], p, margin=margin) for p in target_ecef_candidates)
    return True


# ---------- URL / Session Handling ----------

class SessionState:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session_token: Optional[str] = None

    def build_url(self, base: str, uri: str) -> str:
        full = up.urljoin(base, uri)
        parsed = up.urlparse(full)
        qs = dict(up.parse_qsl(parsed.query))
        if "session" in qs:
            self.session_token = qs["session"]
        elif self.session_token:
            qs["session"] = self.session_token
        qs["key"] = self.api_key
        return up.urlunparse(parsed._replace(query=up.urlencode(qs)))


# ---------- Traversal ----------

def _traverse_once(
    cfg: TileFetchConfig,
    target_ecef_candidates: list,
    max_ge: float,
    margin: float,
) -> tuple[list, dict, list]:
    """Ein Traversal-Durchgang. Sammelt auch 'candidate'-GLBs mit ge > max_ge
    als Fallback, falls die strikte Suche nichts findet.

    Returns: (collected_meshes, stats, candidates) wobei candidates Liste von
    (ge, mesh) sortierbar ist (kleinste ge = beste Auflösung).
    """
    state = SessionState(cfg.api_key)

    root_req_url = state.build_url(ROOT_URL, "")
    _log(f"GET root: {root_req_url.split('?')[0]}")
    r = SESSION.get(root_req_url, timeout=30, headers={"User-Agent": "roof-analyzer/0.1"})
    r.raise_for_status()
    tileset = r.json()

    root_tile = tileset.get("root")
    if not root_tile:
        raise RuntimeError("Tileset ohne root-Tile.")

    collected: list = []
    candidates: list = []  # (ge, mesh) - Fallback wenn strikt nichts gefunden
    stats = {"tiles_visited": 0, "subtilesets": 0, "glbs": 0, "skipped_bv": 0, "errors": 0, "candidates": 0}

    stack: list = [(root_tile, root_req_url, np.eye(4))]

    while stack and stats["tiles_visited"] < cfg.max_tiles and stats["glbs"] < cfg.max_glb:
        tile, base_url, parent_T = stack.pop()
        stats["tiles_visited"] += 1

        tile_T = parent_T
        if "transform" in tile:
            local = np.array(tile["transform"], dtype=np.float64).reshape(4, 4).T
            tile_T = parent_T @ local

        bv = tile.get("boundingVolume", {})
        if not _bv_contains(bv, target_ecef_candidates, cfg.target_lat, cfg.target_lon, margin=margin):
            stats["skipped_bv"] += 1
            continue

        ge = tile.get("geometricError", 1e9)
        content = tile.get("content") or {}
        uri = content.get("uri") or content.get("url")

        _log(f"tile ge={ge:.1f} has_content={bool(uri)} has_children={bool(tile.get('children'))}")

        if uri:
            child_url = state.build_url(base_url, uri)
            try:
                cr = SESSION.get(child_url, timeout=30, headers={"User-Agent": "roof-analyzer/0.1"})
                cr.raise_for_status()
            except Exception as e:
                _log(f"  fehler beim Laden: {e}")
                stats["errors"] += 1
                cr = None

            if cr is not None:
                ctype = cr.headers.get("content-type", "").lower()
                if "json" in ctype or uri.split("?")[0].endswith(".json"):
                    try:
                        sub = cr.json()
                    except Exception:
                        sub = None
                    if sub and "root" in sub:
                        stats["subtilesets"] += 1
                        stack.append((sub["root"], child_url, tile_T))
                else:
                    # GLB laden
                    if ge <= max_ge or not tile.get("children"):
                        mesh = _load_glb(cr.content, tile_T)
                        if mesh is not None and len(mesh.faces) > 0:
                            collected.append(mesh)
                            stats["glbs"] += 1
                            _log(f"  -> GLB geladen ({len(mesh.faces)} Dreiecke)")
                    elif ge < 500:
                        # Zwischenlevel: als Fallback-Kandidat behalten
                        mesh = _load_glb(cr.content, tile_T)
                        if mesh is not None and len(mesh.faces) > 0:
                            candidates.append((ge, mesh))
                            stats["candidates"] += 1

        if ge > max_ge:
            for child in tile.get("children", []) or []:
                stack.append((child, base_url, tile_T))
        elif not uri:
            for child in tile.get("children", []) or []:
                stack.append((child, base_url, tile_T))

    return collected, stats, candidates


def fetch_meshes(cfg: TileFetchConfig) -> trimesh.Trimesh:
    target_ecef_candidates = [
        lla_to_ecef(cfg.target_lon, cfg.target_lat, h)
        for h in (-100.0, 0.0, 150.0, 300.0, 500.0, 1000.0, 2000.0)
    ]

    # Durchlauf 1: strikter Threshold, grosszuegige Marge (100m - hilft in laendlichen
    # Gebieten, wo feine Tiles knappere BoundingVolumes haben)
    collected, stats, candidates = _traverse_once(
        cfg, target_ecef_candidates, max_ge=cfg.max_geometric_error, margin=100.0,
    )
    print(f"  [tiles] Pass1 Stats: {stats}")

    # Wenn Pass 1 leer, aber Kandidaten (Zwischenlevel-GLBs) verfuegbar sind,
    # diese sofort nutzen statt noch einmal alles zu coarsen
    if not collected and candidates:
        candidates.sort(key=lambda t: t[0])
        best_ge = candidates[0][0]
        # nimm bis zu 5 feinste Kandidaten
        collected = [m for ge, m in candidates[:5]]
        print(f"  [tiles] Pass1 -> Fallback auf {len(collected)} Kandidaten (beste ge={best_ge:.1f})")

    # Durchlauf 2: immer noch nichts - lockerer Threshold + noch groessere Marge
    if not collected:
        print("  [tiles] -> Retry Pass2 mit ge<=80, margin=300")
        collected, stats2, more_candidates = _traverse_once(
            cfg, target_ecef_candidates, max_ge=80.0, margin=300.0,
        )
        print(f"  [tiles] Pass2 Stats: {stats2}")
        if not collected and more_candidates:
            more_candidates.sort(key=lambda t: t[0])
            collected = [m for ge, m in more_candidates[:5]]
            print(f"  [tiles] Pass2 -> Fallback auf {len(collected)} Kandidaten")

    if not collected:
        raise RuntimeError(
            f"Keine Tile-Geometrien geladen. "
            f"Google Photorealistic 3D Tiles hat fuer diese Adresse moeglicherweise keine Coverage. "
            f"Versuche ROOF_VERBOSE=1 fuer Details."
        )

    merged = trimesh.util.concatenate(collected)
    return merged


def _load_glb(data: bytes, tile_transform: np.ndarray) -> Optional[trimesh.Trimesh]:
    """Laedt GLB und liefert Mesh in ECEF zurueck.

    Strategie: scene.dump(concatenate=True) loest alle Node-Transforms der
    glTF-Hierarchie korrekt auf. Dann wird der Tile-Transform (aus tileset.json)
    plus die glTF Y-up -> Z-up Rotation drueber gelegt.
    """
    try:
        scene = trimesh.load(io.BytesIO(data), file_type="glb", force="scene")
    except Exception as e:
        _log(f"  glb konnte nicht geladen werden: {e}")
        return None

    # Alle Nodes mit ihren Transforms aufloesen
    try:
        if isinstance(scene, trimesh.Trimesh):
            mesh = scene.copy()
        else:
            mesh = scene.dump(concatenate=True)
    except Exception as e:
        _log(f"  scene.dump fehlgeschlagen: {e}")
        return None

    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0:
        return None

    # glTF ist Y-up, 3D Tiles ECEF erwartet Z-up
    y_up_to_z_up = np.array([
        [1, 0, 0, 0],
        [0, 0, -1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
    ], dtype=np.float64)

    mesh.apply_transform(y_up_to_z_up)
    if not np.allclose(tile_transform, np.eye(4)):
        mesh.apply_transform(tile_transform)
    return mesh
