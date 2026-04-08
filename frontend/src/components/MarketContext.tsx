"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Source {
  source_url?: string | null;
  source_title?: string | null;
}

interface MarketContextData {
  building_profile?: {
    estimated_era?: string;
    building_type?: string;
    likely_heating?: string;
    historic_preservation?: string;
  } & Source;
  energy_prices?: {
    cheapest_provider?: string;
    cheapest_tariff_name?: string;
    price_eur_kwh?: number;
    trend?: string;
    trend_detail?: string;
    local_retail_eur_kwh?: number;
    carbon_price_impact?: string;
  } & Source;
  local_regulations?: (
    { regulation?: string; status?: string; relevance?: string } & Source
  )[];
  municipal_programs?: (
    { name?: string; provider?: string; benefit?: string; description?: string; amount_or_benefit?: string } & Source
  )[];
  local_utility?: {
    name?: string;
    website?: string | null;
    local_tariffs?: string;
    local_programs?: string;
    special_tariffs?: string;
    community_programs?: string;
  } & Source;
  why_now?: string[];
  why_now_triggers?: string[];
  [key: string]: unknown;
}

interface Props {
  data: MarketContextData;
}

const trendBadge: Record<string, "default" | "secondary" | "destructive"> = {
  rising: "destructive",
  stable: "secondary",
  falling: "default",
};

function Val({ v }: { v: string | number | undefined | null }) {
  if (v == null || v === "") return <span className="text-muted-foreground/50 text-xs">—</span>;
  if (String(v) === "NAV") return <span className="text-muted-foreground/50 text-xs italic">n/a</span>;
  return <>{v}</>;
}

function InfoButton({ url, title }: { url?: string | null; title?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <span className="relative inline-block ml-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground hover:bg-blue-100 hover:text-blue-600 transition-colors text-[9px] font-bold leading-none"
        title="View source"
      >
        i
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-5 w-56 rounded-lg border bg-popover p-2 shadow-md text-xs">
          <p className="font-medium truncate mb-1">{title || "Source"}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
          >
            {url}
          </a>
        </div>
      )}
    </span>
  );
}

function SectionHeader({ title, source }: { title: string; source?: Source }) {
  return (
    <div className="flex items-center gap-1 mb-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <InfoButton url={source?.source_url} title={source?.source_title} />
    </div>
  );
}

export default function MarketContext({ data }: Props) {
  if (!data || (data as Record<string, unknown>).error) return null;

  const bp = data.building_profile;
  const ep = data.energy_prices;
  const lu = data.local_utility;
  const regs = data.local_regulations;
  const programs = data.municipal_programs;
  const whyNow = data.why_now ?? data.why_now_triggers ?? [];

  return (
    <div className="space-y-4 mt-4">
      {/* Row 1: Building Profile + Energy Prices */}
      <div className="grid gap-4 sm:grid-cols-2">
        {bp && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Building Profile" source={bp} />
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5 w-28">Era</td>
                    <td><Val v={bp.estimated_era} /></td>
                  </tr>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5">Type</td>
                    <td><Val v={bp.building_type} /></td>
                  </tr>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5">Heating</td>
                    <td><Val v={bp.likely_heating} /></td>
                  </tr>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5">Historic prot.</td>
                    <td>
                      {bp.historic_preservation && bp.historic_preservation !== "NAV" ? (
                        <Badge
                          variant={bp.historic_preservation === "yes" ? "destructive" : bp.historic_preservation === "possible" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {bp.historic_preservation}
                        </Badge>
                      ) : (
                        <Val v={bp.historic_preservation} />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {ep && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Energy Prices" source={ep} />
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5 w-28">Best price</td>
                    <td className="font-semibold tabular-nums">
                      {ep.price_eur_kwh != null ? (
                        <>{ep.price_eur_kwh.toFixed(2)} ct/kWh</>
                      ) : ep.local_retail_eur_kwh != null ? (
                        <>{(ep.local_retail_eur_kwh * 100).toFixed(1)} ct/kWh</>
                      ) : (
                        <Val v={undefined} />
                      )}
                    </td>
                  </tr>
                  {(ep.cheapest_provider || ep.cheapest_tariff_name) && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Provider</td>
                      <td className="text-xs">
                        <Val v={ep.cheapest_provider} />
                        {ep.cheapest_tariff_name && ep.cheapest_tariff_name !== "NAV" && (
                          <span className="text-muted-foreground"> — {ep.cheapest_tariff_name}</span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5">Trend</td>
                    <td>
                      {ep.trend && ep.trend !== "NAV" ? (
                        <Badge variant={trendBadge[ep.trend] ?? "secondary"} className="text-xs">{ep.trend}</Badge>
                      ) : (
                        <Val v={ep.trend} />
                      )}
                    </td>
                  </tr>
                  {(ep.trend_detail || ep.carbon_price_impact) && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Detail</td>
                      <td className="text-xs text-muted-foreground"><Val v={ep.trend_detail ?? ep.carbon_price_impact} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Local Regulations */}
      {regs && regs.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <h4 className="text-sm font-semibold mb-2">Local Regulations</h4>
            <div className="space-y-1.5">
              {regs.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0">
                    {r.status || "—"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.regulation}</span>
                    <InfoButton url={r.source_url} title={r.source_title} />
                    {r.relevance && r.relevance !== "NAV" && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.relevance}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Municipal Programs + Local Utility */}
      <div className="grid gap-4 sm:grid-cols-2">
        {programs && programs.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <h4 className="text-sm font-semibold mb-2">Municipal Programs</h4>
              <div className="space-y-2">
                {programs.map((p, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{p.name}</span>
                      <InfoButton url={p.source_url} title={p.source_title} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.provider}
                      {(p.benefit || p.amount_or_benefit) && (
                        <> — <span className="font-medium text-foreground">{p.benefit || p.amount_or_benefit}</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {lu && lu.name && (
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Local Utility" source={lu} />
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="text-muted-foreground pr-3 py-0.5 w-24">Provider</td>
                    <td>
                      {lu.website ? (
                        <a href={lu.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {lu.name}
                        </a>
                      ) : (
                        <Val v={lu.name} />
                      )}
                    </td>
                  </tr>
                  {(lu.local_tariffs || lu.special_tariffs) && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Tariffs</td>
                      <td className="text-xs"><Val v={lu.local_tariffs ?? lu.special_tariffs} /></td>
                    </tr>
                  )}
                  {(lu.local_programs || lu.community_programs) && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Programs</td>
                      <td className="text-xs"><Val v={lu.local_programs ?? lu.community_programs} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 4: Why Now */}
      {whyNow.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold">Why Now</h4>
              <Badge variant="secondary" className="text-[10px]">AI Analysis</Badge>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {whyNow.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 mt-0.5 shrink-0">→</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
