"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  buildCompareRowContent,
  buildCompareSectionTitleContent,
  type CompareRowKey,
  type EnrichmentInput,
} from "@/lib/buildOfferTooltips";
import { DEGRADATION_YEARLY, HOUSEHOLD_DEFAULT_KWH } from "@/lib/offerCalcConstants";

interface OfferData {
  offer: {
    tier: string;
    label: string;
    capex_eur: number;
    annual_savings_eur: number;
    payback_years: number;
    co2_saved_kg: number;
    self_consumption_pct: number;
    annual_production_kwh: number;
    roof_utilization_pct: number;
    system_kwp: number;
  };
  financing: { subsidy_deducted_eur: number }[];
}

interface Props {
  offers: OfferData[];
  enrichment?: EnrichmentInput;
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number, unit: string) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n)} ${unit}`;
}

function tierLabel(tier: string) {
  if (tier === "starter") return "Solar only";
  if (tier === "recommended") return null;
  return "Full energy package";
}

const rows: {
  label: string;
  explainKey: CompareRowKey;
  icon: React.ReactNode;
  getValue: (o: OfferData) => string;
}[] = [
  {
    label: "System size",
    explainKey: "systemSize",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 12h16M12 4v16" />
      </svg>
    ),
    getValue: (o) => `${o.offer.system_kwp.toFixed(1)} kWp`,
  },
  {
    label: "Annual production",
    explainKey: "annualProduction",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    getValue: (o) => fmtNum(o.offer.annual_production_kwh, "kWh/yr"),
  },
  {
    label: "Self-consumption",
    explainKey: "selfConsumption",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    getValue: (o) => `${Math.round(o.offer.self_consumption_pct)}%`,
  },
  {
    label: "Grid independence",
    explainKey: "gridIndependence",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    getValue: (o) => {
      const selfConsumedKwh = o.offer.annual_production_kwh * (o.offer.self_consumption_pct / 100);
      const pct = Math.min(100, Math.round((selfConsumedKwh / HOUSEHOLD_DEFAULT_KWH) * 100));
      return `${pct}%`;
    },
  },
  {
    label: "Upfront (after subsidies)",
    explainKey: "upfront",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    getValue: (o) => {
      const subsidy = o.financing[0]?.subsidy_deducted_eur ?? 0;
      return fmt(Math.max(0, o.offer.capex_eur - subsidy));
    },
  },
  {
    label: "Annual savings",
    explainKey: "annualSavings",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    getValue: (o) => fmt(o.offer.annual_savings_eur),
  },
  {
    label: "Payback",
    explainKey: "payback",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    getValue: (o) => `${o.offer.payback_years} years`,
  },
  {
    label: "CO₂ saved",
    explainKey: "co2Saved",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    getValue: (o) => fmtNum(o.offer.co2_saved_kg, "kg/yr"),
  },
  {
    label: "Roof utilization",
    explainKey: "roofUtilization",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    getValue: (o) =>
      o.offer.roof_utilization_pct > 0
        ? `${Math.round(o.offer.roof_utilization_pct)}%`
        : "—",
  },
  {
    label: "20-year savings",
    explainKey: "twentyYearSavings",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    getValue: (o) => {
      let total = 0;
      for (let y = 0; y < 20; y++) total += o.offer.annual_savings_eur * Math.pow(DEGRADATION_YEARLY, y);
      return fmt(Math.round(total));
    },
  },
];

export default function CompareNumbers({ offers, enrichment }: Props) {
  const exampleOffer =
    offers.find((o) => o.offer.tier === "recommended") ?? offers[0] ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Compare key numbers</CardTitle>
          <InfoTooltip
            content={buildCompareSectionTitleContent(enrichment)}
            label="About this comparison table"
          />
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left w-[170px]" />
              {offers.map(({ offer: o }) => (
                <th key={o.tier} className="py-2 px-3 text-center">
                  {o.tier === "recommended" ? (
                    <Badge className="bg-blue-600 text-white border-0 text-xs">RECOMMENDED</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">
                      {tierLabel(o.tier)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/50">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-1.5">
                    {row.icon}
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <InfoTooltip
                      content={
                        exampleOffer
                          ? buildCompareRowContent(row.explainKey, exampleOffer, enrichment)
                          : "No offers loaded."
                      }
                      label={`About ${row.label}`}
                    />
                  </div>
                </td>
                {offers.map((o) => {
                  const isRec = o.offer.tier === "recommended";
                  return (
                    <td
                      key={o.offer.tier}
                      className={`py-3 px-3 text-center text-sm tabular-nums ${
                        isRec ? "text-blue-600 font-semibold" : "font-medium"
                      }`}
                    >
                      {row.getValue(o)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
