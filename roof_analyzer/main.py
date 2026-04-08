"""Pipeline-Einstiegspunkt.

Aufruf:
    GOOGLE_MAPS_API_KEY=... python -m roof_analyzer.main "Schloßplatz 1, 70173 Stuttgart"
"""
from __future__ import annotations
import json
import os
import sys
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


def analyze_address(address: str, api_key: str, out_dir: str = ".") -> dict:
    print(f"[1/6] Geocoding: {address}")
    g = geocode(address, api_key)
    print(f"      -> {g.formatted}  ({g.lat:.6f}, {g.lon:.6f}, {g.location_type})")
    if not g.is_precise:
        print("      [warn] Geocoding ist nur APPROXIMATE — Ergebnisse mit Vorsicht.")

    print("[2/6] Lade 3D Tiles ...")
    cfg = TileFetchConfig(api_key=api_key, target_lat=g.lat, target_lon=g.lon)
    raw_mesh = fetch_meshes(cfg)
    print(f"      -> {len(raw_mesh.faces)} Dreiecke geladen")

    print("[3/6] OSM-Footprint laden ...")
    fp_lla = fetch_building_footprint(g.lat, g.lon)
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
        print(f"      [warn] Kein OSM-Footprint - Fallback: {int(half*2)}x{int(half*2)}m Quadrat um Ziel.")

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
    render_roof(roof_mesh, labels, fp_enu, img_path)

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
    }
    json_path = os.path.join(out_dir, "roof_result.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Ergebnis: {json_path}")
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m roof_analyzer.main 'Adresse'")
        sys.exit(1)
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        print("Bitte GOOGLE_MAPS_API_KEY setzen.")
        sys.exit(1)
    analyze_address(" ".join(sys.argv[1:]), key, out_dir=os.getcwd())
