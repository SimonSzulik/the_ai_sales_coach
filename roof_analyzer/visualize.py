"""Top-Down-Visualisierung der klassifizierten Dachflächen — der Demo-Wow-Moment."""
from __future__ import annotations
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
import trimesh
from shapely.geometry import Polygon


def render_roof(roof_mesh: trimesh.Trimesh, labels: np.ndarray, footprint_enu: Polygon | None, out_path: str):
    fig, ax = plt.subplots(figsize=(8, 8))

    if footprint_enu is not None:
        x, y = footprint_enu.exterior.xy
        ax.fill(x, y, color="#eeeeee", alpha=0.6, zorder=0)
        ax.plot(x, y, color="#888888", lw=1)

    cmap = plt.colormaps.get_cmap("tab20")
    tris = roof_mesh.triangles  # (N,3,3)
    for i, tri in enumerate(tris):
        cid = int(labels[i]) if i < len(labels) else -1
        if cid == -1:
            color = "#cccccc"
        else:
            color = cmap(cid % 20)
        poly = MplPolygon(tri[:, :2], facecolor=color, edgecolor="none", alpha=0.85)
        ax.add_patch(poly)

    ax.set_aspect("equal")
    ax.set_xlabel("East [m]")
    ax.set_ylabel("North [m]")
    ax.set_title("Klassifizierte Dachflächen (Top-Down, ENU)")

    # Outlier-robustes Auto-Zoom: 1./99. Perzentil der Centroids plus Margin
    centroids = roof_mesh.triangles_center
    if len(centroids) > 0:
        xs = centroids[:, 0]
        ys = centroids[:, 1]
        x_lo, x_hi = np.percentile(xs, [1, 99])
        y_lo, y_hi = np.percentile(ys, [1, 99])
        mx = max((x_hi - x_lo), (y_hi - y_lo)) * 0.15 + 5
        ax.set_xlim(x_lo - mx, x_hi + mx)
        ax.set_ylim(y_lo - mx, y_hi + mx)
    else:
        ax.autoscale_view()

    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)
