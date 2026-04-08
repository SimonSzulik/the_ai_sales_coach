"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtMonthly(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Cell({
  children,
  isRec,
  green,
}: {
  children: React.ReactNode;
  isRec: boolean;
  green?: boolean;
}) {
  return (
    <td
      className={`py-2.5 px-4 text-center ${
        isRec
          ? green
            ? "bg-blue-600 text-green-200 font-semibold"
            : "bg-blue-600 text-white font-semibold"
          : green
            ? "text-green-600 font-medium"
            : ""
      }`}
    >
      {children}
    </td>
  );
}

function ScenarioBlock({
  title,
  type,
  offers,
}: {
  title: string;
  type: string;
  offers: Props["offers"];
}) {
  const rows: { label: string; render: (f: Financing) => string; green?: boolean }[] = [];

  if (type === "cash") {
    rows.push({ label: "One-time Payment", render: (f) => fmt(f.total_cost_eur) });
    rows.push({ label: "Subsidy Deducted", render: (f) => `−${fmt(f.subsidy_deducted_eur)}`, green: true });
  } else if (type === "partial") {
    rows.push({ label: "Down Payment (30%)", render: (f) => fmt(f.down_payment_eur) });
    rows.push({
      label: "Monthly",
      render: (f) => (f.monthly_payment_eur > 0 ? `${fmtMonthly(f.monthly_payment_eur)}/mo` : "—"),
    });
    rows.push({ label: `Term`, render: (f) => (f.term_years > 0 ? `${f.term_years} years` : "—") });
    rows.push({ label: "Total Cost", render: (f) => fmt(f.total_cost_eur) });
    rows.push({ label: "Subsidy Deducted", render: (f) => `−${fmt(f.subsidy_deducted_eur)}`, green: true });
  } else {
    rows.push({
      label: "Monthly",
      render: (f) => (f.monthly_payment_eur > 0 ? `${fmtMonthly(f.monthly_payment_eur)}/mo` : "—"),
    });
    rows.push({ label: `Term`, render: (f) => (f.term_years > 0 ? `${f.term_years} years` : "—") });
    rows.push({ label: "Total Cost", render: (f) => fmt(f.total_cost_eur) });
    rows.push({ label: "Subsidy Deducted", render: (f) => `−${fmt(f.subsidy_deducted_eur)}`, green: true });
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 mt-4 first:mt-0">{title}</h4>
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/50">
              <td className="py-2.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider w-[140px]">
                {row.label}
              </td>
              {offers.map(({ offer: o, financing }) => {
                const f = financing.find((s) => s.type === type);
                if (!f) return <td key={o.tier} />;
                return (
                  <Cell key={o.tier} isRec={o.tier === "recommended"} green={row.green}>
                    {row.render(f)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancingTable({ offers }: Props) {
  const firstFinancing = offers[0]?.financing;
  if (!firstFinancing || firstFinancing.length === 0) return null;

  const rate = firstFinancing.find((f) => f.interest_rate_pct > 0)?.interest_rate_pct ?? 3.99;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Pillar 2 — The Financing Strategy</CardTitle>
          <Badge variant="secondary" className="text-xs">{rate}% KfW Rate</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Cash, partial, and full financing with subsidies integrated
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Tier headers */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2.5 px-4 text-left w-[140px]" />
                {offers.map(({ offer: o }) => (
                  <th
                    key={o.tier}
                    className={`py-2.5 px-4 text-center uppercase tracking-wider text-xs ${
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
          </table>

          <ScenarioBlock title="Cash Payment" type="cash" offers={offers} />
          <ScenarioBlock title="Partial Financing (30% Down)" type="partial" offers={offers} />
          <ScenarioBlock title="Full Financing (0% Down)" type="full" offers={offers} />
        </div>
      </CardContent>
    </Card>
  );
}
