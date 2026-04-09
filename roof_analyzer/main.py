"""Pipeline-Einstiegspunkt.

Aufruf (API-Key aus Projekt-.env mit GOOGLE_MAPS_API_KEY=... oder Umgebungsvariable):
    python -m roof_analyzer.main "Schloßplatz 1, 70173 Stuttgart"
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path
from dataclasses import asdict

import numpy as np

from .geocode import geocode
from .tiles_3d import TileFetchConfig, fetch_meshes
from .footprint import fetch_building_footprint, footprint_to_enu
from .roof_analysis import (
    mesh_to_enu,
    filter_by_footprint,
    classify_roof,
    cluster_planes,
    summarize_planes,
)
from .visualize import render_roof
from .preview_3d import render_interactive_3d
from .compare_view import render_comparison


def analyze_address(address: str, api_key: str | None = None, out_dir: str = ".") -> dict:
    key = _resolve_google_maps_api_key(api_key)
    print(f"[1/6] Geocoding: {address}")
    g = geocode(address, key)
    print(f"      -> {g.formatted}  ({g.lat:.6f}, {g.lon:.6f}, {g.location_type})")
    if not g.is_precise:
        print("      [warn] Geocoding ist nur APPROXIMATE — Ergebnisse mit Vorsicht.")

    print("[2/6] Lade 3D Tiles ...")
    cfg = TileFetchConfig(api_key=key, target_lat=g.lat, target_lon=g.lon)
    raw_mesh = fetch_meshes(cfg)
    print(f"      -> {len(raw_mesh.faces)} Dreiecke geladen")

    print("[3/6] Gebäude-Footprint laden (Google Solar API) ...")
    fp_lla = fetch_building_footprint(g.lat, g.lon, api_key=key)
    fp_enu = None
    if fp_lla is not None:
        fp_enu = footprint_to_enu(fp_lla, g.lat, g.lon)
        print(f"      -> Polygon mit {len(fp_enu.exterior.coords)} Punkten")
    else:
        # Fallback: 18x18 m Quadrat um den Zielpunkt im ENU-Frame.
        # Besser als kein Clipping - schneidet wenigstens Nachbarhaeuser weg.
        from shapely.geometry import Polygon as ShpPoly
        half = 9.0
        fp_enu = ShpPoly([(-half, -half), (half, -half), (half, half), (-half, half)])
        print(f"      [warn] Kein Solar-API-Footprint - Fallback: {int(half*2)}x{int(half*2)}m Quadrat um Ziel.")

    print("[4/6] Mesh -> ENU + Clipping")
    enu_mesh = mesh_to_enu(raw_mesh, g.lat, g.lon)
    if fp_enu is not None:
        enu_mesh = filter_by_footprint(enu_mesh, fp_enu)
    print(f"      -> {len(enu_mesh.faces)} Dreiecke nach Clipping")

    print("[5/6] Dachklassifikation + Clustering")
    roof_mesh, normals, areas = classify_roof(enu_mesh)
    labels = cluster_planes(normals, roof_mesh.triangles_center)
    planes = summarize_planes(roof_mesh, normals, areas)

    print("[6/6] Visualisierung + Export")
    img_path = os.path.join(out_dir, "roof_topdown.png")
    html_path = os.path.join(out_dir, "roof_preview_3d.html")
    compare_path = os.path.join(out_dir, "roof_vs_maps.png")
    render_roof(roof_mesh, labels, fp_enu, img_path)

    # Side-by-side Vergleich Modell vs. Google Maps Satellit
    try:
        ok = render_comparison(
            roof_mesh=roof_mesh,
            full_mesh=enu_mesh,
            labels=labels,
            footprint_enu=fp_enu,
            lat=g.lat,
            lon=g.lon,
            api_key=key,
            out_path=compare_path,
            address=g.formatted,
        )
        if ok:
            print(f"      -> Vergleich Satellit vs. Modell: {compare_path}")
        else:
            print(f"      [warn] Vergleich erstellt, Satellitenbild fehlte: {compare_path}")
    except Exception as e:
        print(f"      [warn] Vergleichsbild fehlgeschlagen: {e}")
        compare_path = None

    planes_dicts = [asdict(p) for p in planes]
    try:
        render_interactive_3d(
            roof_mesh=roof_mesh,
            full_mesh=enu_mesh,          # mit Waenden als Kontext
            labels=labels,
            planes=planes_dicts,
            footprint_enu=fp_enu,
            address=g.formatted,
            out_path=html_path,
        )
        print(f"      -> interaktive 3D-Vorschau: {html_path}")
    except Exception as e:
        print(f"      [warn] 3D-HTML-Export fehlgeschlagen: {e}")
        html_path = None

    result = {
        "address": g.formatted,
        "lat": g.lat,
        "lon": g.lon,
        "location_type": g.location_type,
        "total_roof_area_m2": round(float(sum(p.area_m2 for p in planes)), 2),
        "total_estimated_kwp": round(float(sum(p.estimated_kwp for p in planes)), 2),
        "planes": planes_dicts,
        "preview": img_path,
        "preview_3d": html_path,
        "compare_maps": compare_path,
    }
    json_path = os.path.join(out_dir, "roof_result.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Ergebnis: {json_path}")
    return result


def _find_dotenv_path(filename: str = ".env") -> Path | None:
    """Locate ``.env`` by walking up from cwd and from the ``roof_analyzer`` package directory.

    Works for arbitrary project folders, monorepos, and different shells/OS paths: the first
    existing file wins (search from cwd runs first, then from the package root).
    """
    max_levels = 32
    seen: set[Path] = set()
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        cur = start.resolve()
        for _ in range(max_levels):
            candidate = (cur / filename).resolve()
            if candidate not in seen:
                seen.add(candidate)
                if candidate.is_file():
                    return candidate
            if cur.parent == cur:
                break
            cur = cur.parent
    return None


def _load_dotenv(path: str = ".env") -> None:
    """Load KEY=VALUE pairs from a .env file into os.environ (no 'export' needed)."""
    env_path = _find_dotenv_path(path)
    if env_path is None:
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):]
            key_val = line.split("=", 1)
            if len(key_val) != 2:
                continue
            k, v = key_val[0].strip(), key_val[1].strip()
            v = v.strip("\"'")
            os.environ.setdefault(k, v)


def get_google_maps_api_key() -> str | None:
    """Load ``.env`` if found (see ``_find_dotenv_path``), then return ``GOOGLE_MAPS_API_KEY`` or ``None``."""
    _load_dotenv()
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    return key or None


def _resolve_google_maps_api_key(explicit: str | None) -> str:
    _load_dotenv()
    key = (explicit or "").strip() or os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        raise ValueError(
            "GOOGLE_MAPS_API_KEY is not set. Add GOOGLE_MAPS_API_KEY to the project .env file "
            "or set the environment variable."
        )
    return key


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m roof_analyzer.main 'Adresse'")
        sys.exit(1)
    try:
        analyze_address(" ".join(sys.argv[1:]), out_dir=os.getcwd())
    except ValueError as e:
        print(str(e))
        sys.exit(1)
