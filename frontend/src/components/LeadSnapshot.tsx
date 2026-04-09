"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMapEmbedUrl } from "@/lib/api";

interface Props {
  lead: { name: string; address: string; zip_code: string; product_interest?: string };
  geo: {
    confidence: string;
    data: {
      latitude?: number;
      longitude?: number;
      display_name?: string;
      city?: string;
      building_type?: string;
    };
  };
}

export default function LeadSnapshot({ lead, geo }: Props) {
  const lat = geo.data.latitude;
  const lon = geo.data.longitude;
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lon == null) {
      setMapUrl(null);
      return;
    }
    let cancelled = false;
    getMapEmbedUrl(lat, lon, { zoom: 18, maptype: "roadmap" }).then((url) => {
      if (!cancelled) setMapUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Lead Snapshot</CardTitle>
          <Badge variant={geo.confidence === "high" ? "default" : "secondary"}>
            {geo.confidence}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{lead.name}</span>
          <span className="text-muted-foreground">Address</span>
          <span className="font-medium">{lead.address}</span>
          <span className="text-muted-foreground">Postal Code</span>
          <span className="font-medium">{lead.zip_code}</span>
          {geo.data.city && (
            <>
              <span className="text-muted-foreground">City</span>
              <span className="font-medium">{geo.data.city}</span>
            </>
          )}
          {lead.product_interest && (
            <>
              <span className="text-muted-foreground">Interest</span>
              <span className="font-medium">{lead.product_interest}</span>
            </>
          )}
        </div>
        {mapUrl && (
          <iframe
            src={mapUrl}
            className="w-full h-48 rounded-md border"
            loading="lazy"
          />
        )}
      </CardContent>
    </Card>
  );
}
