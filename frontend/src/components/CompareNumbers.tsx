"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OfferData {
  offer: {
    tier: string;
    label: string;
    capex_eur: number;
    annual_savings_eur: number;
    payback_years: number;
    co2_saved_kg: number;
  };
  financing: { subsidy_deducted_eur: number }[];
}

interface Props {
  offers: OfferData[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function tierLabel(tier: string) {
  if (tier === "starter") return "Solar only";
  if (tier === "recommended") return null;
  return "Solar + battery + heating";
}

const rows: {
  label: string;
  icon: React.ReactNode;
  getValue: (o: OfferData) => string;
}[] = [
  {
    label: "Upfront (after subsidies)",
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
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    getValue: (o) => fmt(o.offer.annual_savings_eur),
  },
  {
    label: "Energy independence",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    getValue: (o) => {
      if (o.offer.tier === "starter") return "30%";
      if (o.offer.tier === "recommended") return "70%";
      return "90%";
    },
  },
  {
    label: "Payback",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    getValue: (o) => `${o.offer.payback_years} years`,
  },
  {
    label: "20-year savings",
    icon: (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    getValue: (o) => fmt(o.offer.annual_savings_eur * 20),
  },
];

export default function CompareNumbers({ offers }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Compare key numbers</CardTitle>
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
                  <div className="flex items-center gap-2">
                    {row.icon}
                    <span className="text-sm text-muted-foreground">{row.label}</span>
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
