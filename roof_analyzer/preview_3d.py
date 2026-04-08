"""Interaktive 3D-Vorschau als self-contained HTML.

Rendert die klassifizierten Dachflaechen in Plotly Mesh3d. Per-Face-Faerbung nach
Cluster und Eignung. HTML enthaelt Plotly.js inline -> oeffnen und rotieren.
"""
from __future__ import annotations
from typing import List
import numpy as np
import plotly.graph_objects as go
import trimesh
from shapely.geometry import Polygon

# Farbpalette fuer Cluster (nach Eignung tintiert)
_SUITABILITY_COLORS = {
    "high":   "#2ca02c",   # gruen
    "medium": "#ffbb33",   # gelb-orange
    "low":    "#d62728",   # rot
    None:     "#bdbdbd",   # grau (nicht klassifiziert)
}


def _color_for(suit: str) -> str:
    return _SUITABILITY_COLORS.get(suit, "#bdbdbd")


def render_interactive_3d(
    roof_mesh: trimesh.Trimesh,
    full_mesh: trimesh.Trimesh | None,
    labels: np.ndarray,
    planes: list,
    footprint_enu: Polygon | None,
    address: str,
    out_path: str,
) -> None:
    """Schreibt HTML mit interaktiver 3D-Vorschau.

    - roof_mesh: klassifizierte Dachdreiecke (ENU, m)
    - full_mesh: optional ganzes Gebaeude-Mesh (fuer Wand-Kontext)
    - labels: Cluster-ID pro Dachdreieck
    - planes: Liste der RoofPlane-Dicts (fuer Eignungs-Mapping)
    - footprint_enu: Gebaeude-Polygon im ENU-Frame
    """
    # Cluster-ID -> Suitability-Mapping aus planes-Liste
    suit_by_cluster = {p["cluster_id"]: p["suitability"] for p in planes}

    traces = []

    # 1) Kontextflaeche: Wand-/Boden-Dreiecke des Gebaeudes in dezentem Grau
    if full_mesh is not None and len(full_mesh.faces) > 0:
        # nur Dreiecke, die NICHT im roof_mesh sind -> Wand/Kontext
        v = np.asarray(full_mesh.vertices)
        f = np.asarray(full_mesh.faces)
        traces.append(go.Mesh3d(
            x=v[:, 0], y=v[:, 1], z=v[:, 2],
            i=f[:, 0], j=f[:, 1], k=f[:, 2],
            color="#cfcfcf",
            opacity=0.35,
            flatshading=True,
            name="Gebaeude (Waende)",
            showscale=False,
            hoverinfo="skip",
        ))

    # 2) Dachdreiecke nach Cluster gruppieren -> pro Cluster ein Mesh3d
    v = np.asarray(roof_mesh.vertices)
    f = np.asarray(roof_mesh.faces)
    lbl = np.asarray(labels)

    # Aggregiere pro Cluster-ID
    unique_clusters = sorted(set(lbl.tolist()))
    for cid in unique_clusters:
        mask = (lbl == cid)
        faces_c = f[mask]
        if len(faces_c) == 0:
            continue
        suit = suit_by_cluster.get(cid)
        color = _color_for(suit) if cid != -1 else "#bdbdbd"
        plane_info = next((p for p in planes if p["cluster_id"] == cid), None)
        if plane_info:
            name = (f"Cluster {cid}  {plane_info['area_m2']:.0f} m2  "
                    f"tilt {plane_info['tilt_deg']:.0f}d  az {plane_info['azimuth_deg']:.0f}d  "
                    f"[{suit}]  {plane_info['estimated_kwp']} kWp")
        else:
            name = f"Cluster {cid} (unklassifiziert)"

        traces.append(go.Mesh3d(
            x=v[:, 0], y=v[:, 1], z=v[:, 2],
            i=faces_c[:, 0], j=faces_c[:, 1], k=faces_c[:, 2],
            color=color,
            opacity=0.92,
            flatshading=True,
            name=name,
            showlegend=True,
            hovertext=name,
            hoverinfo="text",
        ))

    # 3) Footprint-Polygon als duenner Grundriss-Streifen bei z=min
    if footprint_enu is not None:
        x, y = footprint_enu.exterior.xy
        z_floor = float(np.percentile(v[:, 2], 2)) if len(v) else 0.0
        traces.append(go.Scatter3d(
            x=list(x), y=list(y), z=[z_floor] * len(x),
            mode="lines",
            line=dict(color="#333333", width=4),
            name="Footprint (OSM)",
            hoverinfo="skip",
        ))

    # Layout: equal aspect ratio, dunkler Hintergrund
    fig = go.Figure(data=traces)
    fig.update_layout(
        title=f"Roof Analyzer - {address}",
        scene=dict(
            xaxis=dict(title="East [m]", backgroundcolor="#f7f7f7"),
            yaxis=dict(title="North [m]", backgroundcolor="#f7f7f7"),
            zaxis=dict(title="Up [m]", backgroundcolor="#f7f7f7"),
            aspectmode="data",  # KRITISCH: sonst wird das Gebaeude verzerrt
            camera=dict(eye=dict(x=1.3, y=-1.3, z=0.9)),
        ),
        margin=dict(l=0, r=0, t=40, b=0),
        legend=dict(
            title="Dachflaechen (Legende klickbar)",
            bgcolor="rgba(255,255,255,0.85)",
            bordercolor="#888",
            borderwidth=1,
            font=dict(size=10),
        ),
        height=800,
    )

    # Self-contained HTML (Plotly.js inline, keine CDN noetig)
    fig.write_html(
        out_path,
        include_plotlyjs="inline",
        full_html=True,
        config={
            "displaylogo": False,
            "modeBarButtonsToRemove": ["toImage"],
            "scrollZoom": True,
        },
    )
