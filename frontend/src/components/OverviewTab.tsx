"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HOUSEHOLD_DEFAULT_KWH } from "@/lib/offerCalcConstants";
import { getMapEmbedUrl } from "@/lib/api";
import { useDashboard } from "@/components/DashboardContext";
import { Button } from "@/components/ui/button";

interface Props {
  lead: {
    name: string;
    address: string;
    zip_code: string;
    product_interest?: string;
  };
  /** Annual kWh/yr driving offer economics (lead form + Offers tab usage slider); mirrors briefing. */
  annualHouseholdKwh: number;
  geo: { confidence: string; data: Record<string, unknown> };
  solar: { confidence: string; data: Record<string, unknown> };
  energy: { confidence: string; data: Record<string, unknown> };
  subsidies: { confidence: string; data: Record<string, unknown> };
  marketContext: { confidence: string; data: Record<string, unknown> };
  roofAnalysis?: { confidence: string; data: Record<string, unknown> };
  drivers: string[];
}

function parseRoofPlanes(data: Record<string, unknown> | undefined): {
  planes: { tilt_deg: number; azimuth_deg: number; area_m2?: number; suitability?: string }[];
  error: unknown;
  totalRoofArea: number | undefined;
} {
  if (!data) return { planes: [], error: undefined, totalRoofArea: undefined };
  const error = data.error;
  const raw = data.planes;
  if (!Array.isArray(raw)) return { planes: [], error, totalRoofArea: undefined };
  const planes = raw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const tilt = o.tilt_deg;
      const az = o.azimuth_deg;
      if (typeof tilt !== "number" || typeof az !== "number") return null;
      const area = o.area_m2;
      const suit = o.suitability;
      return {
        tilt_deg: tilt,
        azimuth_deg: az,
        area_m2: typeof area === "number" ? area : undefined,
        suitability: typeof suit === "string" ? suit : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const tra = data.total_roof_area_m2;
  return {
    planes,
    error,
    totalRoofArea: typeof tra === "number" ? tra : undefined,
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);
}

function fmtEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function parseRetailEurKwh(data: Record<string, unknown>): number | undefined {
  const v = data.retail_price_eur_kwh;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Normalize market AI tariff fields to €/kWh (handles values stored as ct/kWh in some fields). */
function marketScanEurPerKwh(ep: Record<string, unknown>): number | undefined {
  const local = ep.local_retail_eur_kwh;
  if (typeof local === "number" && Number.isFinite(local) && local > 0) {
    if (local < 1.2) return local;
    if (local < 150) return local / 100;
  }
  const p = ep.price_eur_kwh;
  if (typeof p === "number" && Number.isFinite(p) && p > 0) {
    if (p < 1.2) return p;
    if (p < 150) return p / 100;
  }
  return undefined;
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
  annualHouseholdKwh,
  geo,
  solar,
  energy,
  subsidies,
  marketContext,
  roofAnalysis,
  drivers,
}: Props) {
  const { setActiveSection } = useDashboard();
  const mc = marketContext.data as Record<string, unknown>;
  const bp = (mc?.building_profile ?? {}) as Record<string, string | undefined>;
  const ep = (mc?.energy_prices ?? {}) as Record<string, unknown>;
  const lu = (mc?.local_utility ?? {}) as Record<string, string | undefined>;

  const solarData = solar.data as Record<string, unknown>;
  const energyData = energy.data as Record<string, unknown>;
  const subsidyData = subsidies.data as Record<string, unknown>;
  const geoData = geo.data as Record<string, unknown>;

  const city = geoData.city as string | undefined;
  const lat = geoData.latitude as number | undefined;
  const lon = geoData.longitude as number | undefined;
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  useEffect(() => {
    if (lat == null || lon == null) {
      setMapUrl(null);
      return;
    }
    let cancelled = false;
    getMapEmbedUrl(lat, lon, { zoom: 16, maptype: "roadmap", mode: "place" }).then((url) => {
      if (!cancelled) setMapUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  const roofData = roofAnalysis?.data;
  const { planes: roofPlanes, error: roofError, totalRoofArea } = parseRoofPlanes(roofData);
  const hasRoofGeometry = roofPlanes.length > 0 && roofError == null;

  const confidenceRows = [
    { label: "Location", conf: geo.confidence },
    { label: "Solar", conf: solar.confidence },
    { label: "Energy", conf: energy.confidence },
    { label: "Subsidies", conf: subsidies.confidence },
    { label: "Market AI", conf: marketContext.confidence },
    ...(roofAnalysis
      ? [{ label: "Roof 3D", conf: roofAnalysis.confidence }]
      : []),
  ];

  const highConfidenceCount = confidenceRows.filter((r) => r.conf === "high").length;
  const yieldKwp =
    solarData.annual_kwh_per_kwp != null ? Number(solarData.annual_kwh_per_kwp) : undefined;
  const yieldOk = yieldKwp != null && Number.isFinite(yieldKwp);
  const subsidyEur =
    subsidyData.total_potential_eur != null ? Number(subsidyData.total_potential_eur) : undefined;
  const subsidyOk = subsidyEur != null && Number.isFinite(subsidyEur) && subsidyEur > 0;
  const smardRetail = parseRetailEurKwh(energyData);
  const marketRetail = marketScanEurPerKwh(ep);
  const hasSmard = smardRetail != null && smardRetail > 0;
  const hasMarketTariff = marketRetail != null && marketRetail > 0;

  const buildingHasAny =
    !!(bp.estimated_era || bp.building_type || bp.likely_heating || bp.historic_preservation);

  const trendStr = typeof ep.trend === "string" ? ep.trend : "";
  const trendDetailStr = typeof ep.trend_detail === "string" ? ep.trend_detail : "";
  const showPriceTrend =
    (trendStr && trendStr !== "NAV") || (trendDetailStr && trendDetailStr !== "NAV");

  const optAngleNum =
    solarData.optimal_angle != null ? Number(solarData.optimal_angle) : Number.NaN;
  const optAzNum =
    solarData.optimal_azimuth != null ? Number(solarData.optimal_azimuth) : Number.NaN;
  const pvgisAnglesMeaningful =
    Number.isFinite(optAngleNum) &&
    Number.isFinite(optAzNum) &&
    !(optAngleNum === 0 && optAzNum === 0);

  return (
    <div className="space-y-6 mt-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">At a glance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Key numbers from this briefing. Opportunity score is in the header.
            </p>
          </div>
          {lead.product_interest && (
            <Badge variant="secondary" className="text-xs font-medium">
              {lead.product_interest}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
          Household electricity for offer math:{" "}
          <strong className="text-foreground tabular-nums">
            {annualHouseholdKwh.toLocaleString("de-DE")} kWh/yr
          </strong>
          .{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline font-medium"
            onClick={() => setActiveSection("offers")}
          >
            Change on Offers
          </button>{" "}
          (form default {HOUSEHOLD_DEFAULT_KWH.toLocaleString("de-DE")} kWh/yr if unset).
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-sky-200/60 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-sm dark:from-sky-950/25 dark:to-background">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Solar yield
              </span>
            </div>
            {yieldOk ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-sky-900 dark:text-sky-100">
                  {fmt(yieldKwp!)}{" "}
                  <span className="text-sm font-semibold text-sky-700/80">kWh/kWp·yr</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">PVGIS site reference</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting solar data</p>
            )}
          </div>

          <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm dark:from-emerald-950/25 dark:to-background">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Subsidies
              </span>
            </div>
            {subsidyOk ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {fmtEur(subsidyEur!)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Potential (enricher)</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Check eligibility</p>
            )}
          </div>

          <div className="rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm dark:from-violet-950/25 dark:to-background">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-violet-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Model retail
              </span>
            </div>
            {hasSmard ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-violet-900 dark:text-violet-100">
                  {fmt(smardRetail!)}{" "}
                  <span className="text-sm font-semibold text-violet-800/80">€/kWh</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">SMARD-based model</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Awaiting energy model</p>
            )}
          </div>

          <div className="rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-50/90 to-white p-4 shadow-sm dark:from-orange-950/25 dark:to-background">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                vs market scan
              </span>
            </div>
            {hasMarketTariff ? (
              <>
                <div className="text-2xl font-bold tabular-nums text-orange-900 dark:text-orange-100">
                  {fmt(marketRetail!)}{" "}
                  <span className="text-sm font-semibold text-orange-800/80">€/kWh</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasSmard && smardRetail != null && marketRetail != null
                    ? marketRetail > smardRetail
                      ? "Above model retail"
                      : marketRetail < smardRetail
                        ? "Below model retail"
                        : "Matches model order of magnitude"
                    : "AI web scan (not SMARD)"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No market tariff in briefing</p>
            )}
          </div>
        </div>
      </section>

      {mapUrl && (
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Property location</CardTitle>
            <p className="text-sm text-muted-foreground">
              {city ? `${city} · satellite preview` : "Satellite preview"}
            </p>
          </CardHeader>
          <CardContent className="p-0 px-4 pb-4">
            <div className="rounded-xl border overflow-hidden shadow-inner">
              <iframe
                title="Property map"
                src={mapUrl}
                className="w-full min-h-[14rem] h-56 md:h-72"
                loading="lazy"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Site and opportunity</CardTitle>
              <p className="text-xs text-muted-foreground">Why this lead and what we know about the building.</p>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {buildingHasAny && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Property context</h4>
                  <div className="rounded-lg border bg-muted/20 divide-y divide-border/60">
                    {bp.estimated_era && (
                      <InfoRow label="Era" value={bp.estimated_era} />
                    )}
                    {bp.building_type && <InfoRow label="Type" value={bp.building_type} />}
                    {bp.likely_heating && <InfoRow label="Heating" value={bp.likely_heating} />}
                    {bp.historic_preservation && bp.historic_preservation !== "NAV" && (
                      <InfoRow label="Historic protection" value={bp.historic_preservation} />
                    )}
                  </div>
                </div>
              )}

              {roofAnalysis && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Roof</h4>
                  {hasRoofGeometry ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {totalRoofArea != null && (
                          <span>~{fmt(totalRoofArea)} m² total · </span>
                        )}
                        {roofPlanes.length} plane{roofPlanes.length === 1 ? "" : "s"}. Tilt, orientation, and 3D view
                        are on Roof analysis.
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={() => setActiveSection("roof")}>
                        Open roof analysis
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Roof geometry appears when 3D analysis completes.
                    </p>
                  )}
                </div>
              )}

              {pvgisAnglesMeaningful && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Location solar reference (PVGIS)</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Reference fixed tilt (latitude rule) and south azimuth (PVGIS convention) — not measured roof.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">Reference tilt (site)</span>
                      <span className="font-medium tabular-nums">{fmt(optAngleNum)}°</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">Reference azimuth (south = 0°)</span>
                      <span className="font-medium tabular-nums">{fmt(optAzNum)}°</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Market and energy</CardTitle>
              <p className="text-xs text-muted-foreground">Local prices and utility — from market enricher where available.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {showPriceTrend && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Price trend</h4>
                  <p className="text-sm text-muted-foreground">
                    {trendStr && trendStr !== "NAV" && (
                      <Badge variant="outline" className="mr-2 text-xs capitalize">
                        {trendStr}
                      </Badge>
                    )}
                    {trendDetailStr && trendDetailStr !== "NAV" ? trendDetailStr : null}
                    {!trendDetailStr && trendStr === "rising" && "Energy prices increasing in this context."}
                  </p>
                </div>
              )}

              {lu.name && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Local utility</h4>
                  <InfoRow label="Provider" value={lu.name} />
                  {(lu.local_tariffs || lu.special_tariffs) && (
                    <InfoRow label="Tariffs" value={(lu.local_tariffs ?? lu.special_tariffs) as string} />
                  )}
                </div>
              )}

              {!!energyData.retail_price_eur_kwh &&
                typeof energyData.retail_price_eur_kwh === "number" &&
                energyData.retail_price_eur_kwh > 0.3 &&
                !trendStr && (
                  <p className="text-xs text-muted-foreground">
                    Elevated model retail supports the case for self-consumption and solar.
                  </p>
                )}

              {!showPriceTrend &&
                !lu.name &&
                !(
                  typeof energyData.retail_price_eur_kwh === "number" &&
                  energyData.retail_price_eur_kwh > 0.3 &&
                  !trendStr
                ) && (
                  <p className="text-xs text-muted-foreground">
                    No local utility or price trend from the market enricher in this briefing.
                  </p>
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      <details className="group rounded-xl border bg-card text-sm">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium flex items-center justify-between gap-2">
          <span>
            Data confidence —{" "}
            <span className="tabular-nums text-muted-foreground font-normal">
              {highConfidenceCount} of {confidenceRows.length} sources high
            </span>
          </span>
          <svg
            className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-0 border-t border-border/60">
          <div className="space-y-2 pt-3">
            {confidenceRows.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs w-20 text-muted-foreground shrink-0">{item.label}</span>
                <Progress
                  value={item.conf === "high" ? 100 : item.conf === "medium" ? 60 : item.conf === "low" ? 30 : 5}
                  className="h-1.5 flex-1"
                />
                <Badge
                  variant={item.conf === "high" ? "default" : item.conf === "medium" ? "secondary" : "outline"}
                  className="text-xs w-16 justify-center shrink-0"
                >
                  {item.conf}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
