"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RoofAnalysisTab() {
  return (
    <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Solarflächennutzung & Analyse</h2>
          <p className="text-sm text-muted-foreground">Validierung des 3D-Modells gegen Satellitendaten</p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
          Modell erfolgreich generiert
        </Badge>
      </div>

      {/* Obere Reihe: 3D Modell & Draufsicht */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* 3D iframe */}
        <Card className="flex flex-col h-[450px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
              Interaktives 3D-Dachmodell
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-white overflow-hidden rounded-b-xl">
            <iframe
              className="w-full h-full absolute inset-0"
              src="/roof_preview_3d.html"
              title="3D Model Viewer"
              frameBorder="0"
            />
            <div className="absolute bottom-3 left-3 pointer-events-none bg-background/80 backdrop-blur text-xs px-2 py-1 rounded-md border shadow-sm">
              Tipp: Mit der Maus drehen & zoomen
            </div>
          </CardContent>
        </Card>

        {/* 2D Draufsicht */}
        <Card className="flex flex-col h-[450px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Klassifizierte Dachflächen (Draufsicht)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex items-center justify-center bg-white rounded-b-xl overflow-hidden">
            <img
              src="/roof_topdown.png"
              alt="Klassifizierte Dachflächen Draufsicht"
              className="w-full h-full object-contain"
            />
          </CardContent>
        </Card>
      </div>

      {/* Untere Reihe: Der 3er Vergleich (ist als einzelnes Bild hinterlegt) */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-lg">
            Validierung: Modell vs. Google Maps
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 bg-muted/5 flex items-center justify-center rounded-b-xl">
          <img
            src="/roof_vs_maps.png"
            alt="Vergleich Modell vs Google Maps"
            className="w-full h-auto object-contain rounded-lg border shadow-sm bg-white"
          />
        </CardContent>
      </Card>
    </div>
  );
}