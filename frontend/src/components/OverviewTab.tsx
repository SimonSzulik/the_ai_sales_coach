"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  lead: {
    name: string;
    address: string;
    zip_code: string;
    product_interest?: string;
  };
  geo: { confidence: string; data: Record<string, unknown> };
  solar: { confidence: string; data: Record<string, unknown> };
  energy: { confidence: string; data: Record<string, unknown> };
  subsidies: { confidence: string; data: Record<string, unknown> };
  marketContext: { confidence: string; data: Record<string, unknown> };
  score: number;
  drivers: string[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
}

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function OverviewTab({
  lead,
  geo,
  solar,
  energy,
  subsidies,
  marketContext,
  score,
  drivers,
}: Props) {
  const mc = marketContext.data as Record<string, unknown>;
  const bp = (mc?.building_profile ?? {}) as Record<string, string>;
  const ep = (mc?.energy_prices ?? {}) as Record<string, unknown>;
  const lu = (mc?.local_utility ?? {}) as Record<string, string>;

  const solarData = solar.data as Record<string, unknown>;
  const energyData = energy.data as Record<string, unknown>;
  const subsidyData = subsidies.data as Record<string, unknown>;
  const geoData = geo.data as Record<string, unknown>;

  const lat = geoData.latitude as number | undefined;
  const lon = geoData.longitude as number | undefined;
  const mapUrl =
    lat && lon
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.005},${lat - 0.003},${lon + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lon}`
      : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      {/* Left — About the Customer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">About the Customer</CardTitle>
          <p className="text-xs text-muted-foreground">Key insights to personalise your approach.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Profile</h4>
            <InfoRow label="Name" value={lead.name} />
            <InfoRow label="Address" value={lead.address} />
            <InfoRow label="Postal code" value={lead.zip_code} />
            <InfoRow label="City" value={geoData.city as string} />
            <InfoRow label="Interest" value={lead.product_interest} />
          </div>

          {/* Opportunity drivers */}
          {drivers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">What drives this opportunity</h4>
              <ul className="space-y-1.5">
                {drivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 mt-0.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Building profile from AI */}
          {bp.estimated_era && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Building Profile</h4>
              <InfoRow label="Era" value={bp.estimated_era} />
              <InfoRow label="Type" value={bp.building_type} />
              <InfoRow label="Heating" value={bp.likely_heating} />
              <InfoRow
                label="Monument protection"
                value={bp.monument_protection}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right — About the Property */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">About the Property</CardTitle>
            <p className="text-xs text-muted-foreground">Data-driven insights about the home.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Solar potential */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground mb-1">Solar potential</div>
                {solarData.annual_kwh_per_kwp ? (
                  <>
                    <Badge variant={Number(solarData.annual_kwh_per_kwp) > 1000 ? "default" : "secondary"} className="text-xs mb-1">
                      {Number(solarData.annual_kwh_per_kwp) > 1000 ? "HIGH" : "MODERATE"} ({fmt(Number(solarData.annual_kwh_per_kwp))})
                    </Badge>
                    <div className="text-lg font-bold">
                      ~{fmt(Number(solarData.annual_kwh_per_kwp) * 8)} kWh/yr
                    </div>
                    <div className="text-xs text-muted-foreground">Est. annual production (8 kWp)</div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No data</span>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground mb-1">Subsidies available</div>
                <div className="text-lg font-bold text-green-600">
                  {subsidyData.total_potential_eur
                    ? `Up to ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(subsidyData.total_potential_eur))}`
                    : "Check eligibility"}
                </div>
                <div className="text-xs text-muted-foreground">KfW / BAFA programs</div>
              </div>
            </div>

            {/* Energy context */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Energy Context</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-muted-foreground">
                    Energy prices {ep.trend === "rising" ? "increasing" : ep.trend as string}
                    {ep.local_retail_eur_kwh ? ` — ${fmt(Number(ep.local_retail_eur_kwh))} EUR/kWh` : ""}
                  </span>
                </div>
                {!!subsidyData.total_potential_eur && Number(subsidyData.total_potential_eur) > 0 && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-muted-foreground">
                      Subsidies available — Up to {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(subsidyData.total_potential_eur))}
                    </span>
                  </div>
                )}
                {!!energyData.retail_price_eur_kwh && Number(energyData.retail_price_eur_kwh) > 0.30 && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-muted-foreground">Regulation favorable — high self-consumption value</span>
                  </div>
                )}
              </div>
            </div>

            {/* Local utility */}
            {lu.name && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Local Utility</h4>
                <InfoRow label="Provider" value={lu.name} />
                {lu.special_tariffs && <InfoRow label="Tariffs" value={lu.special_tariffs} />}
              </div>
            )}

            {/* Roof analysis / solar details */}
            {solarData.optimal_angle != null && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Roof Analysis</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tilt</span>
                    <span className="font-medium">{String(solarData.optimal_angle)}°</span>
                  </div>
                  {solarData.optimal_azimuth != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Orientation</span>
                      <span className="font-medium">{String(solarData.optimal_azimuth)}°</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        {mapUrl && (
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-xl">
              <iframe
                src={mapUrl}
                className="w-full h-48"
                loading="lazy"
              />
            </CardContent>
          </Card>
        )}

        {/* Confidence */}
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-2">Data confidence by source</div>
            <div className="space-y-2">
              {[
                { label: "Location", conf: geo.confidence },
                { label: "Solar", conf: solar.confidence },
                { label: "Energy", conf: energy.confidence },
                { label: "Subsidies", conf: subsidies.confidence },
                { label: "Market AI", conf: marketContext.confidence },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">{item.label}</span>
                  <Progress
                    value={item.conf === "high" ? 100 : item.conf === "medium" ? 60 : item.conf === "low" ? 30 : 5}
                    className="h-1.5 flex-1"
                  />
                  <Badge
                    variant={item.conf === "high" ? "default" : item.conf === "medium" ? "secondary" : "outline"}
                    className="text-xs w-16 justify-center"
                  >
                    {item.conf}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
