"""Side-by-side Vergleich: Google-Maps-Satellit vs. erkanntes 3D-Dach.

Dieses Modul holt ein Static-Maps-Satellitenbild der Adresse und legt es
neben (und unter) unser top-down klassifiziertes Dachmodell. So sieht der
Nutzer auf einen Blick, dass die erkannte Dachgeometrie exakt zum echten
Gebaeude in Google Maps passt - das ist die visuelle Validierung.
"""
from __future__ import annotations

import io
import math
from typing import Optional

import numpy as np
import requests
import trimesh
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
import matplotlib.image as mpimg
from shapely.geometry import Polygon


STATIC_MAPS_URL = "https://maps.googleapis.com/maps/api/staticmap"


def _meters_per_pixel(lat_deg: float, zoom: int) -> float:
    return 156543.03392 * math.cos(math.radians(lat_deg)) / (2 ** zoom)


def _fetch_satellite_image(
    lat: float,
    lon: float,
    api_key: str,
    zoom: int = 20,
    size: int = 640,
) -> Optional[np.ndarray]:
    """Laedt ein Satellitenbild via Google Static Maps API.
    Gibt das Bild als numpy-Array (H, W, 3/4) zurueck oder None."""
    params = {
        "center": f"{lat},{lon}",
        "zoom": str(zoom),
        "size": f"{size}x{size}",
        "maptype": "satellite",
        "scale": "2",  # Retina - liefert 2*size px bei gleichem m/px
        "key": api_key,
    }
    try:
        r = requests.get(STATIC_MAPS_URL, params=params, timeout=15)
        if r.status_code != 200:
            print(f"      [warn] Static Maps HTTP {r.status_code}: {r.text[:200]}")
            return None
        img = mpimg.imread(io.BytesIO(r.content), format="png")
        return img
    except Exception as e:
        print(f"      [warn] Static Maps Fetch fehlgeschlagen: {e}")
        return None


def _auto_zoom(lat: float, target_extent_m: float, img_size: int = 640) -> int:
    """Waehlt einen Zoom-Level so, dass target_extent_m in das Bild passt."""
    best_z = 20
    for z in range(21, 15, -1):
        mpp = _meters_per_pixel(lat, z)
        view_m = mpp * img_size
        if view_m >= target_extent_m:
            best_z = z
            break
    return best_z


def render_comparison(
    roof_mesh: trimesh.Trimesh,
    full_mesh: trimesh.Trimesh,
    labels: np.ndarray,
    footprint_enu: Optional[Polygon],
    lat: float,
    lon: float,
    api_key: str,
    out_path: str,
    address: str = "",
) -> bool:
    """Rendert ein Vergleichsbild (Satellit | Modell | Overlay).

    Rueckgabe True bei Erfolg, False wenn der Satelliten-Fetch scheiterte.
    """
    # 1) Gewuenschten Kartenausschnitt aus den Mesh-Bounds bestimmen.
    centroids = roof_mesh.triangles_center if len(roof_mesh.triangles) else np.zeros((0, 3))
    if len(centroids) > 0:
        xs = centroids[:, 0]
        ys = centroids[:, 1]
        x_lo, x_hi = np.percentile(xs, [1, 99])
        y_lo, y_hi = np.percentile(ys, [1, 99])
        extent_m = max(x_hi - x_lo, y_hi - y_lo) + 25.0
    else:
        extent_m = 50.0
    extent_m = max(extent_m, 40.0)  # Mindestausschnitt, damit Kontext sichtbar bleibt

    img_size = 640  # Static Maps Basisgroesse; scale=2 liefert 1280px Pixel-Output
    zoom = _auto_zoom(lat, extent_m, img_size=img_size)
    mpp = _meters_per_pixel(lat, zoom)
    half_m = (img_size / 2.0) * mpp  # Halbe Breite in Metern (Bildmitte = lat,lon)
    map_extent = [-half_m, half_m, -half_m, half_m]

    sat_img = _fetch_satellite_image(lat, lon, api_key, zoom=zoom, size=img_size)

    # 2) Figure mit drei Panels anlegen.
    fig, axes = plt.subplots(1, 3, figsize=(18, 6.5))
    ax_sat, ax_model, ax_overlay = axes

    # Gemeinsame Achsen-Einstellungen
    for ax in axes:
        ax.set_aspect("equal")
        ax.set_xlim(-half_m, half_m)
        ax.set_ylim(-half_m, half_m)
        ax.set_xlabel("East [m]")

    ax_sat.set_ylabel("North [m]")

    # Panel 1: reine Satellitenansicht
    if sat_img is not None:
        ax_sat.imshow(sat_img, extent=map_extent, origin="upper")
    else:
        ax_sat.text(0.5, 0.5, "Satellitenbild\nnicht verfuegbar",
                    ha="center", va="center", transform=ax_sat.transAxes,
                    color="#888", fontsize=13)
    ax_sat.set_title("Google Maps Satellit", fontweight="bold")

    # Panel 2: unser Top-Down-Modell (wie vorher, aber mit gleichem Extent)
    cmap = plt.colormaps.get_cmap("tab20")
    # Optional: Wand-/Kontextdreiecke in hellgrau
    if full_mesh is not None and len(full_mesh.triangles) > 0:
        for tri in full_mesh.triangles:
            poly = MplPolygon(tri[:, :2], facecolor="#e8e8e8",
                              edgecolor="none", alpha=0.5, zorder=0)
            ax_model.add_patch(poly)

    if footprint_enu is not None:
        fx, fy = footprint_enu.exterior.xy
        ax_model.plot(fx, fy, color="#2a2a2a", lw=1.2, zorder=1)

    tris = roof_mesh.triangles
    for i, tri in enumerate(tris):
        cid = int(labels[i]) if i < len(labels) else -1
        color = "#cccccc" if cid == -1 else cmap(cid % 20)
        poly = MplPolygon(tri[:, :2], facecolor=color, edgecolor="#222",
                          linewidth=0.3, alpha=0.9, zorder=2)
        ax_model.add_patch(poly)
    ax_model.set_title("Erkanntes 3D-Dach (Top-Down)", fontweight="bold")
    ax_model.set_facecolor("#f7f7f7")

    # Panel 3: Satellit + Dach-Overlay
    if sat_img is not None:
        ax_overlay.imshow(sat_img, extent=map_extent, origin="upper")
    for i, tri in enumerate(tris):
        cid = int(labels[i]) if i < len(labels) else -1
        color = "#ff2a2a" if cid == -1 else cmap(cid % 20)
        poly = MplPolygon(tri[:, :2], facecolor=color, edgecolor="white",
                          linewidth=0.6, alpha=0.55, zorder=2)
        ax_overlay.add_patch(poly)
    if footprint_enu is not None:
        fx, fy = footprint_enu.exterior.xy
        ax_overlay.plot(fx, fy, color="#ffff00", lw=1.5, zorder=3)
    ax_overlay.set_title("Overlay: Erkannte Flaechen auf Satellit", fontweight="bold")

    # Gesamttitel
    suptitle = "Validierung: Modell vs. Google Maps"
    if address:
        suptitle += f"  -  {address}"
    fig.suptitle(suptitle, fontsize=13, fontweight="bold")

    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return sat_img is not None
