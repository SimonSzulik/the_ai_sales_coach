"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface OfferProps {
  offers: {
    offer: {
      tier: string;
      label: string;
      components: { name: string; description: string; unit_cost_eur: number }[];
      capex_eur: number;
      annual_savings_eur: number;
      payback_years: number;
      co2_saved_kg: number;
    };
  }[];
}

const tierBadge: Record<string, string> = {
  starter: "secondary",
  recommended: "default",
  premium: "outline",
};

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function OfferComparison({ offers }: OfferProps) {
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Offer Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {offers.map(({ offer: o }) => (
            <div
              key={o.tier}
              className={`rounded-lg border p-4 flex flex-col gap-3 ${
                o.tier === "recommended" ? "border-primary ring-1 ring-primary/20" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{o.label}</h3>
                <Badge variant={tierBadge[o.tier] as "default" | "secondary" | "outline"}>
                  {o.tier}
                </Badge>
              </div>
              <Separator />
              <ul className="text-sm space-y-1 text-muted-foreground">
                {o.components.map((c, i) => (
                  <li key={i}>{c.description}</li>
                ))}
              </ul>
              <Separator />
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Upfront</span>
                <span className="text-right font-medium">{fmt(o.capex_eur)}</span>
                <span className="text-muted-foreground">Annual savings</span>
                <span className="text-right font-medium">{fmt(o.annual_savings_eur)}</span>
                <span className="text-muted-foreground">Payback</span>
                <span className="text-right font-medium">{o.payback_years} yrs</span>
                <span className="text-muted-foreground">CO&#x2082; saved</span>
                <span className="text-right font-medium">{(o.co2_saved_kg / 1000).toFixed(1)} t/yr</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
