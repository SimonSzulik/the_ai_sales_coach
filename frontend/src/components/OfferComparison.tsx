"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


interface OfferProps {
  offers: {
    offer: {
      tier: string;
      label: string;
      rationale: string;
      components: { name: string; description: string; unit_cost_eur: number }[];
      capex_eur: number;
      annual_savings_eur: number;
      payback_years: number;
      co2_saved_kg: number;
    };
  }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Cell({
  children,
  isRec,
  header,
}: {
  children: React.ReactNode;
  isRec: boolean;
  header?: boolean;
}) {
  return (
    <td
      className={`py-3 px-4 text-center ${
        isRec
          ? "bg-blue-600 text-white font-semibold"
          : header
            ? "font-semibold"
            : ""
      }`}
    >
      {children}
    </td>
  );
}

export default function OfferComparison({ offers }: OfferProps) {
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Compare Key Numbers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {/* Header */}
            <thead>
              <tr className="border-b">
                <th className="py-3 px-4 text-left w-[140px]" />
                {offers.map(({ offer: o }) => (
                  <th
                    key={o.tier}
                    className={`py-3 px-4 text-center uppercase tracking-wider text-xs ${
                      o.tier === "recommended"
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground"
                    }`}
                  >
                    {o.tier === "premium" ? "Full" : o.tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* What to buy */}
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  Package
                </td>
                {offers.map(({ offer: o }) => {
                  const isRec = o.tier === "recommended";
                  return (
                    <Cell key={o.tier} isRec={isRec}>
                      <div className="text-left">
                        {o.components.map((c, i) => (
                          <div key={i} className={`text-xs ${isRec ? "text-blue-100" : "text-muted-foreground"}`}>
                            {c.description}
                          </div>
                        ))}
                      </div>
                    </Cell>
                  );
                })}
              </tr>

              {/* Why */}
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  Why
                </td>
                {offers.map(({ offer: o }) => (
                  <Cell key={o.tier} isRec={o.tier === "recommended"}>
                    <p className={`text-xs text-left ${o.tier === "recommended" ? "text-blue-100" : "text-muted-foreground"}`}>
                      {o.rationale}
                    </p>
                  </Cell>
                ))}
              </tr>

              {/* Upfront */}
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  Upfront
                </td>
                {offers.map(({ offer: o }) => (
                  <Cell key={o.tier} isRec={o.tier === "recommended"}>
                    {fmt(o.capex_eur)}
                  </Cell>
                ))}
              </tr>

              {/* Annual Savings */}
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  Annual Savings
                </td>
                {offers.map(({ offer: o }) => (
                  <Cell key={o.tier} isRec={o.tier === "recommended"}>
                    {fmt(o.annual_savings_eur)}
                  </Cell>
                ))}
              </tr>

              {/* Payback */}
              <tr className="border-b">
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  Payback
                </td>
                {offers.map(({ offer: o }) => (
                  <Cell key={o.tier} isRec={o.tier === "recommended"}>
                    {o.payback_years} years
                  </Cell>
                ))}
              </tr>

              {/* CO2 saved */}
              <tr>
                <td className="py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                  CO₂ Saved
                </td>
                {offers.map(({ offer: o }) => (
                  <Cell key={o.tier} isRec={o.tier === "recommended"}>
                    {(o.co2_saved_kg / 1000).toFixed(1)} t/yr
                  </Cell>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
