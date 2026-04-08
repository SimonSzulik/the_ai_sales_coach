"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Financing {
  type: string;
  down_payment_eur: number;
  loan_principal_eur: number;
  interest_rate_pct: number;
  term_years: number;
  monthly_payment_eur: number;
  total_cost_eur: number;
  subsidy_deducted_eur: number;
}

interface Props {
  offers: {
    offer: { tier: string; label: string; capex_eur: number };
    financing: Financing[];
  }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtMonthly(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export default function FinancingTable({ offers }: Props) {
  const [selectedTier, setSelectedTier] = useState(offers[1]?.offer.tier ?? offers[0]?.offer.tier ?? "starter");
  const current = offers.find((o) => o.offer.tier === selectedTier);
  if (!current) return null;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Financing Scenarios</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTier} onValueChange={setSelectedTier}>
          <TabsList className="mb-4">
            {offers.map(({ offer: o }) => (
              <TabsTrigger key={o.tier} value={o.tier} className="capitalize">
                {o.tier}
              </TabsTrigger>
            ))}
          </TabsList>

          {offers.map(({ offer: o, financing }) => (
            <TabsContent key={o.tier} value={o.tier}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="py-2 pr-4 font-medium">Scenario</th>
                      <th className="py-2 pr-4 font-medium text-right">Down Payment</th>
                      <th className="py-2 pr-4 font-medium text-right">Monthly</th>
                      <th className="py-2 pr-4 font-medium text-right">Term</th>
                      <th className="py-2 pr-4 font-medium text-right">Total Cost</th>
                      <th className="py-2 font-medium text-right">Subsidy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financing.map((f) => (
                      <tr key={f.type} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium capitalize">{f.type}</td>
                        <td className="py-2 pr-4 text-right">{fmt(f.down_payment_eur)}</td>
                        <td className="py-2 pr-4 text-right">
                          {f.monthly_payment_eur > 0 ? fmtMonthly(f.monthly_payment_eur) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {f.term_years > 0 ? `${f.term_years} yrs` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">{fmt(f.total_cost_eur)}</td>
                        <td className="py-2 text-right text-green-600">-{fmt(f.subsidy_deducted_eur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
