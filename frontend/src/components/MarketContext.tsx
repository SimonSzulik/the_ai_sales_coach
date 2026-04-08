"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Regulation {
  regulation: string;
  status: string;
  relevance: string;
}

interface MunicipalProgram {
  name: string;
  provider: string;
  description: string;
  amount_or_benefit: string;
}

interface MarketContextData {
  energy_prices?: {
    local_retail_eur_kwh?: number;
    trend?: string;
    carbon_price_impact?: string;
  };
  building_profile?: {
    estimated_era?: string;
    likely_heating?: string;
    monument_protection?: string;
    building_type?: string;
  };
  local_regulations?: Regulation[];
  neighbour_adoption?: {
    solar_visible?: string;
    notes?: string;
  };
  municipal_programs?: MunicipalProgram[];
  local_utility?: {
    name?: string;
    special_tariffs?: string;
    community_programs?: string;
  };
  why_now_triggers?: string[];
  research_notes?: string;
}

interface Props {
  data: MarketContextData;
}

const trendBadge: Record<string, "default" | "secondary" | "destructive"> = {
  rising: "destructive",
  stable: "secondary",
  falling: "default",
};

const adoptionBadge: Record<string, "default" | "secondary" | "outline"> = {
  high: "default",
  moderate: "secondary",
  low: "outline",
  unknown: "outline",
};

export default function MarketContext({ data }: Props) {
  if (!data || 'error' in data) return null;

  const bp = data.building_profile;
  const ep = data.energy_prices;
  const na = data.neighbour_adoption;
  const lu = data.local_utility;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Market & Regulatory Context</CardTitle>
          <Badge variant="secondary" className="text-xs">AI-Researched</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Building Profile + Energy Prices side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          {bp && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Building Profile</h4>
              <table className="w-full text-sm">
                <tbody>
                  {bp.estimated_era && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">Era</td><td>{bp.estimated_era}</td></tr>
                  )}
                  {bp.building_type && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">Type</td><td>{bp.building_type}</td></tr>
                  )}
                  {bp.likely_heating && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">Heating</td><td>{bp.likely_heating}</td></tr>
                  )}
                  {bp.monument_protection && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Denkmalschutz</td>
                      <td>
                        <Badge variant={bp.monument_protection === "likely" ? "destructive" : bp.monument_protection === "possible" ? "secondary" : "outline"} className="text-xs">
                          {bp.monument_protection}
                        </Badge>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {ep && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Energy Prices</h4>
              <table className="w-full text-sm">
                <tbody>
                  {ep.local_retail_eur_kwh != null && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Retail price</td>
                      <td>{ep.local_retail_eur_kwh.toFixed(2)} EUR/kWh</td>
                    </tr>
                  )}
                  {ep.trend && (
                    <tr>
                      <td className="text-muted-foreground pr-3 py-0.5">Trend</td>
                      <td><Badge variant={trendBadge[ep.trend] ?? "secondary"} className="text-xs">{ep.trend}</Badge></td>
                    </tr>
                  )}
                  {ep.carbon_price_impact && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">CO₂ pricing</td><td className="text-xs">{ep.carbon_price_impact}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Local Regulations */}
        {data.local_regulations && data.local_regulations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Local Regulations</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-3 text-muted-foreground font-medium">Regulation</th>
                    <th className="py-1 pr-3 text-muted-foreground font-medium">Status</th>
                    <th className="py-1 text-muted-foreground font-medium">Relevance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.local_regulations.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 pr-3">{r.regulation}</td>
                      <td className="py-1.5 pr-3">{r.status}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">{r.relevance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Municipal Programs & Local Subsidies */}
        {data.municipal_programs && data.municipal_programs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Municipal Programs & Local Subsidies</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-3 text-muted-foreground font-medium">Program</th>
                    <th className="py-1 pr-3 text-muted-foreground font-medium">Provider</th>
                    <th className="py-1 pr-3 text-muted-foreground font-medium">Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.municipal_programs.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 pr-3">
                        <div>{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.description}</div>
                      </td>
                      <td className="py-1.5 pr-3">{p.provider}</td>
                      <td className="py-1.5 font-medium">{p.amount_or_benefit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Local Utility + Neighbour Adoption side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          {lu && lu.name && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Local Utility (Stadtwerke)</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="text-muted-foreground pr-3 py-0.5">Provider</td><td>{lu.name}</td></tr>
                  {lu.special_tariffs && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">Tariffs</td><td className="text-xs">{lu.special_tariffs}</td></tr>
                  )}
                  {lu.community_programs && (
                    <tr><td className="text-muted-foreground pr-3 py-0.5">Programs</td><td className="text-xs">{lu.community_programs}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {na && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Neighbour Adoption</h4>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">Solar visibility:</span>
                <Badge variant={adoptionBadge[na.solar_visible ?? "unknown"] ?? "outline"} className="text-xs">
                  {na.solar_visible ?? "unknown"}
                </Badge>
              </div>
              {na.notes && <p className="text-xs text-muted-foreground">{na.notes}</p>}
            </div>
          )}
        </div>

        {/* Why Now Triggers */}
        {data.why_now_triggers && data.why_now_triggers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Why Now</h4>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {data.why_now_triggers.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Research Notes */}
        {data.research_notes && (
          <p className="text-xs text-muted-foreground italic border-t pt-2">{data.research_notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
