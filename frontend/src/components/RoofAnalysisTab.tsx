"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { compassFromAzimuth } from "@/lib/roofGeometry";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const IFRAME_LOAD_TIMEOUT_MS = 45_000;

interface RoofPlane {
  area_m2: number;
  estimated_kwp: number;
  tilt_deg: number;
  azimuth_deg: number;
  orientation?: string;
  suitability?: string;
}

interface RoofData {
  address?: string;
  total_roof_area_m2?: number;
  total_estimated_kwp?: number;
  planes?: RoofPlane[];
  error?: string;
  location_type?: string;
}

export interface RoofAnalysisMeta {
  confidence?: string;
  fallback_used?: boolean;
}

interface Props {
  leadId: string;
  roofData?: RoofData | null;
  roofMeta?: RoofAnalysisMeta | null;
}

function suitabilityBadge(s: string | undefined) {
  const v = (s || "low").toLowerCase();
  if (v === "high") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">High</Badge>;
  }
  if (v === "medium") {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-foreground">Medium</Badge>;
  }
  return <Badge variant="secondary">Low</Badge>;
}

function modelStatusBadge(meta: RoofAnalysisMeta | null | undefined) {
  const c = (meta?.confidence || "none").toLowerCase();
  if (c === "high") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
        High confidence
      </Badge>
    );
  }
  if (c === "medium") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200">
        Medium confidence
      </Badge>
    );
  }
  if (c === "low") {
    return <Badge variant="secondary">Low confidence</Badge>;
  }
  return <Badge variant="outline">Limited data</Badge>;
}

export default function RoofAnalysisTab({ leadId, roofData, roofMeta }: Props) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);

  const assetBase = `${API_BASE}/roof_outputs/${leadId}`;
  const preview3dUrl = `${assetBase}/roof_preview_3d.html`;
  const topdownUrl = `${assetBase}/roof_topdown.png`;
  const compareUrl = `${assetBase}/roof_vs_maps.png`;

  const errMsg = roofData?.error;
  const hasError = errMsg !== undefined && errMsg !== null && String(errMsg).length > 0;
  const hasMetrics =
    roofData &&
    !hasError &&
    roofData.total_roof_area_m2 !== undefined &&
    roofData.total_roof_area_m2 !== null;

  useEffect(() => {
    setImgError({});
    setIframeLoaded(false);
    setIframeTimedOut(false);
  }, [leadId]);

  useEffect(() => {
    if (!hasMetrics) return;
    const t = window.setTimeout(() => {
      setIframeTimedOut((prev) => (iframeLoaded ? false : true));
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [leadId, hasMetrics, iframeLoaded, preview3dUrl]);

  if (roofData === undefined || roofData === null) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium text-muted-foreground">No roof analysis data</p>
            <p className="text-sm text-muted-foreground mt-2">
              This briefing does not include roof enrichment. Open the briefing again after the pipeline finishes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground space-y-2">
              <svg className="w-10 h-10 mx-auto text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="font-medium">Roof analysis unavailable</p>
              <p className="text-sm">The 3D roof model could not be generated for this address.</p>
              <p className="text-xs font-mono text-muted-foreground/80 mt-2 max-w-lg mx-auto break-words">{String(errMsg)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasMetrics) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground space-y-2">
              <p className="font-medium">Roof metrics unavailable</p>
              <p className="text-sm max-w-md mx-auto">
                The analyzer did not return a total roof area. The mesh may be incomplete, or geocoding was too imprecise for this address.
              </p>
              {roofData.location_type && (
                <p className="text-xs text-muted-foreground">Location type: {roofData.location_type}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planes = roofData.planes ?? [];
  const locHint = roofData.location_type && roofData.location_type !== "ROOFTOP" && (
    <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-1">
      Geocode precision: {roofData.location_type} — interpret geometry with care.
    </p>
  );

  return (
    <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Roof Analysis</h2>
          <p className="text-sm text-muted-foreground">
            {roofData.address || "3D model validation against satellite data"}
          </p>
          {locHint}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modelStatusBadge(roofMeta)}
          {roofMeta?.fallback_used && (
            <Badge variant="outline">Fallback data used</Badge>
          )}
        </div>
      </div>

      <Card className="border-muted bg-muted/30">
        <CardContent className="py-3 px-4 text-sm text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">How to read these numbers</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong className="text-foreground font-medium">Area</strong> is the sum of mesh clusters (3D tiles), not a surveyed footprint — it can differ from the real roof.
            </li>
            <li>
              <strong className="text-foreground font-medium">kWp</strong> uses a nameplate rule (~0.18 kW/m² DC). It does not include shading or inverter limits. Offer cards use the same kWp for sizing;{" "}
              <strong className="text-foreground font-medium">annual kWh</strong> in offers also applies tilt and orientation factors.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{roofData.total_roof_area_m2?.toFixed(1)} m&sup2;</p>
            <p className="text-xs text-muted-foreground mt-1">Detected roof area (mesh)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{roofData.total_estimated_kwp?.toFixed(1)} kWp</p>
            <p className="text-xs text-muted-foreground mt-1">Nameplate estimate (0.18 kW/m²)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{planes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Roof planes detected</p>
          </CardContent>
        </Card>
      </div>

      {/* 3D Model + Top-down view */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col h-[550px]">
          <CardHeader className="pb-3 border-b space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                </svg>
                Interactive 3D Roof Model
              </CardTitle>
              <Link
                href={preview3dUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline shrink-0"
              >
                Open in new tab
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-white overflow-hidden rounded-b-xl">
            {!iframeLoaded && !iframeTimedOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-[1]">
                <p className="text-sm text-muted-foreground animate-pulse">Loading 3D view...</p>
              </div>
            )}
            {iframeTimedOut && !iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/40 z-[1] px-4">
                <p className="text-sm text-center text-muted-foreground">
                  The 3D preview did not load in time. Use &quot;Open in new tab&quot; or check that the backend serves{" "}
                  <code className="text-xs bg-muted px-1 rounded">/roof_outputs/{leadId}/</code>.
                </p>
              </div>
            )}
            <iframe
              className="w-full h-full absolute inset-0 bg-transparent"
              src={preview3dUrl}
              title="3D Model Viewer"
              frameBorder={0}
              scrolling="no"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeTimedOut(false);
              }}
            />
            {/* Tooltip nach oben links verschoben (top-3), damit er der Legende nicht im Weg ist */}
            <div className="absolute top-3 left-3 pointer-events-none bg-background/80 backdrop-blur text-xs px-2 py-1 rounded-md border shadow-sm z-10">
              Tip: Drag to rotate, scroll to zoom
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-[550px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Classified Roof Planes (Top-down)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex items-center justify-center bg-white rounded-b-xl overflow-hidden">
            {imgError["topdown"] ? (
              <p className="text-sm text-muted-foreground">Image not available</p>
            ) : (
              <img
                src={topdownUrl}
                alt="Classified roof planes top-down view"
                className="w-full h-full object-contain"
                onError={() => setImgError((prev) => ({ ...prev, topdown: true }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plane details table */}
      {planes.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg">Roof Plane Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">#</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Area</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Est. kWp</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Tilt</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Orientation</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Suitability</th>
                  </tr>
                </thead>
                <tbody>
                  {planes.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.area_m2.toFixed(1)} m&sup2;</td>
                      <td className="py-2 pr-4 tabular-nums">{p.estimated_kwp.toFixed(1)}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.tilt_deg.toFixed(0)}&deg;</td>
                      <td className="py-2 pr-4">
                        {p.orientation || compassFromAzimuth(p.azimuth_deg)} ({p.azimuth_deg.toFixed(0)}&deg;)
                      </td>
                      <td className="py-2 pr-4">{suitabilityBadge(p.suitability)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison image */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-lg">Validation: Model vs. Google Maps</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Satellite imagery © Google — use according to Google Maps Platform terms.
          </p>
        </CardHeader>
        <CardContent className="p-4 bg-muted/5 flex items-center justify-center rounded-b-xl">
          {imgError["compare"] ? (
            <p className="text-sm text-muted-foreground py-8">Comparison image not available</p>
          ) : (
            <img
              src={compareUrl}
              alt="Comparison model vs Google Maps"
              className="w-full h-auto object-contain rounded-lg border shadow-sm bg-white max-h-[min(80vh,900px)]"
              onError={() => setImgError((prev) => ({ ...prev, compare: true }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}