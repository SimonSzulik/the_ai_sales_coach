# Roof Analyzer — Solar-Dachanalyse aus Google Photorealistic 3D Tiles

Dieses Modul nimmt eine Adresse, lädt das echte 3D-Mesh der Umgebung von Google,
isoliert das Zielgebäude über den OSM-Footprint und liefert für jede einzelne
Dachfläche **Tilt, Azimuth, Fläche, PV-Eignung und kWp-Potenzial** zurück.

Gebaut für die Cloover-Challenge bei QHack 2026.

## Pipeline

1. `geocode.py` — Adresse → Lat/Lon (Google Geocoding API). Bricht ab, wenn nur APPROXIMATE.
2. `tiles_3d.py` — Traversiert das 3D-Tileset, lädt nur Leaves im 40-m-Radius mit feiner Auflösung, merged alle `.glb`-Meshes (in ECEF).
3. `coords.py` — Konvertiert Vertices von ECEF nach ENU (East-North-Up) am Standort. **Ohne diesen Schritt sind Tilt und Azimuth falsch**, weil "oben" in ECEF radial vom Erdmittelpunkt zeigt, nicht entlang Z.
4. `footprint.py` — Holt den Gebäude-Polygon von OSM via Overpass und transformiert ihn ebenfalls nach ENU.
5. `roof_analysis.py` — Clippt Mesh auf Footprint, filtert Wände (`normal.z > 0.5`) und Boden (Höhen-Perzentil), clustert verbleibende Dreiecke nach Normalenrichtung mit DBSCAN, summarisiert pro Cluster.
6. `visualize.py` — Top-Down-Plot der eingefärbten Dachflächen für die Demo.

## Setup

```bash
pip install -r requirements.txt
export GOOGLE_MAPS_API_KEY="..."   # mit Map Tiles + Geocoding API aktiviert
python -m roof_analyzer.main "Schloßplatz 1, 70173 Stuttgart"
```

Output:
- `roof_result.json` — strukturierte Ergebnisse für den Sales-Agent-Pipeline-Konsumenten
- `roof_topdown.png` — Visualisierung der erkannten Dachflächen

## Beispiel-Output

```json
{
  "address": "Schloßplatz 1, 70173 Stuttgart, Deutschland",
  "total_roof_area_m2": 184.3,
  "total_estimated_kwp": 33.18,
  "planes": [
    {"cluster_id": 0, "area_m2": 92.1, "tilt_deg": 35.2, "azimuth_deg": 178.0,
     "suitability": "high", "estimated_kwp": 16.58, "triangle_count": 412},
    {"cluster_id": 1, "area_m2": 92.2, "tilt_deg": 35.4, "azimuth_deg": 358.1,
     "suitability": "low", "estimated_kwp": 16.60, "triangle_count": 408}
  ]
}
```

## Bekannte Limitierungen

- **Keine Semantik:** Photorealistic 3D Tiles haben kein Labeling. Bäume neben dem Haus, die ins Footprint-Polygon ragen, können fälschlich als Dachfläche erscheinen. Höhen-Filter und ein engerer Footprint helfen.
- **Geometrie-Soup:** Die Meshes sind nicht nach Gebäuden segmentiert — der OSM-Clip ist deshalb essenziell, kein Optional.
- **Verschattung wird nicht berechnet.** Stretch Goal: `pvlib.solarposition` + `trimesh.ray` für stündliche Sonnenstands-Raycasts über das Jahr.
- **Neubaugebiete** haben häufig noch keine 3D-Coverage — Fallback auf Google Solar API oder reine Footprint-basierte Schätzung.
- **Attribution-Pflicht:** Photorealistic 3D Tiles erfordern sichtbares Google-Branding in der UI. In die Demo einbauen.

## Nächste Schritte für die Cloover-Pipeline

Der `roof_result.json`-Output ist genau der Input, den der „Quant-Module"-Schritt
des Sales-Agent-Pipelines aus dem Brainstorming braucht: pro Roof-Plane wird ein
PV-Sizing-Szenario gerechnet, mit Payback und 20-Jahres-NPV. Verschattungs-,
Förder- und Finanzierungslogik laufen darüber.
