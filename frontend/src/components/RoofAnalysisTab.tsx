"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface RoofPlane {
  area_m2: number;
  estimated_kwp: number;
  tilt_deg: number;
  azimuth_deg: number;
  orientation: string;
}

interface RoofData {
  address?: string;
  total_roof_area_m2?: number;
  total_estimated_kwp?: number;
  planes?: RoofPlane[];
  error?: string;
}

interface Props {
  leadId: string;
  roofData?: RoofData | null;
}

function compassLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function RoofAnalysisTab({ leadId, roofData }: Props) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const assetBase = `${API_BASE}/roof_outputs/${leadId}`;
  const preview3dUrl = `${assetBase}/roof_preview_3d.html`;
  const topdownUrl = `${assetBase}/roof_topdown.png`;
  const compareUrl = `${assetBase}/roof_vs_maps.png`;

  const hasError = roofData?.error;
  const hasData = roofData && !hasError && roofData.total_roof_area_m2 != null;

  useEffect(() => {
    setImgError({});
    setIframeLoaded(false);
  }, [leadId]);

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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground space-y-2 animate-pulse">
              <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
              <p className="font-medium">Generating 3D roof model...</p>
              <p className="text-sm">Analyzing the building at this address. This may take a moment.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const planes = roofData.planes ?? [];

  return (
    <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Roof Analysis</h2>
          <p className="text-sm text-muted-foreground">
            {roofData.address || "3D model validation against satellite data"}
          </p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
          Model generated
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{roofData.total_roof_area_m2?.toFixed(1)} m&sup2;</p>
            <p className="text-xs text-muted-foreground mt-1">Total roof area</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{roofData.total_estimated_kwp?.toFixed(1)} kWp</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated capacity</p>
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
        <Card className="flex flex-col h-[450px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
              Interactive 3D Roof Model
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-white overflow-hidden rounded-b-xl">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                <p className="text-sm text-muted-foreground animate-pulse">Loading 3D view...</p>
              </div>
            )}
            <iframe
              className="w-full h-full absolute inset-0"
              src={preview3dUrl}
              title="3D Model Viewer"
              frameBorder="0"
              onLoad={() => setIframeLoaded(true)}
            />
            <div className="absolute bottom-3 left-3 pointer-events-none bg-background/80 backdrop-blur text-xs px-2 py-1 rounded-md border shadow-sm">
              Tip: Drag to rotate, scroll to zoom
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-[450px]">
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
                onError={() => setImgError(prev => ({ ...prev, topdown: true }))}
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
                        {p.orientation || compassLabel(p.azimuth_deg)} ({p.azimuth_deg.toFixed(0)}&deg;)
                      </td>
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
        </CardHeader>
        <CardContent className="p-4 bg-muted/5 flex items-center justify-center rounded-b-xl">
          {imgError["compare"] ? (
            <p className="text-sm text-muted-foreground py-8">Comparison image not available</p>
          ) : (
            <img
              src={compareUrl}
              alt="Comparison model vs Google Maps"
              className="w-full h-auto object-contain rounded-lg border shadow-sm bg-white"
              onError={() => setImgError(prev => ({ ...prev, compare: true }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
