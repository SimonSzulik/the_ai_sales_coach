"use client";

import { Badge } from "@/components/ui/badge";

interface Financing {
  type: string;
  monthly_payment_eur: number;
  subsidy_deducted_eur: number;
}

interface OfferData {
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
  financing: Financing[];
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

const tierConfig: Record<string, { badge: string; badgeVariant: "outline" | "default" | "secondary"; highlight?: string }> = {
  starter: { badge: "BASIC", badgeVariant: "outline" },
  recommended: { badge: "BEST CHOICE", badgeVariant: "default", highlight: "RECOMMENDED" },
  premium: { badge: "PREMIUM", badgeVariant: "outline" },
};

export default function OfferCards({ offers }: Props) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">Tailored offers</h2>
        <p className="text-sm text-muted-foreground">Three solutions. One clear recommendation.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {offers.map(({ offer: o, financing }) => {
          const isRec = o.tier === "recommended";
          const config = tierConfig[o.tier] ?? tierConfig.starter;
          const subsidy = financing[0]?.subsidy_deducted_eur ?? 0;
          const priceAfterSubsidy = Math.max(0, o.capex_eur - subsidy);
          const fullFinancing = financing.find((f) => f.type === "full");
          const monthly = fullFinancing?.monthly_payment_eur ?? 0;

          return (
            <div
              key={o.tier}
              className={`relative rounded-2xl border flex flex-col overflow-hidden transition-shadow ${
                isRec
                  ? "bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/20 ring-2 ring-blue-600/30"
                  : "bg-card border-border shadow-sm hover:shadow-md"
              }`}
            >
              {/* Badge bar */}
              <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                {isRec && (
                  <Badge className="bg-blue-800 text-white border-0 text-xs">
                    {config.badge}
                  </Badge>
                )}
                {config.highlight && (
                  <Badge className={isRec ? "bg-white text-blue-600 border-0 text-xs font-semibold" : "text-xs"}>
                    {config.highlight}
                  </Badge>
                )}
                {!isRec && (
                  <Badge variant={config.badgeVariant} className="text-xs">
                    {config.badge}
                  </Badge>
                )}
              </div>

              {/* Title + rationale */}
              <div className="px-5 pb-3">
                <h3 className={`text-lg font-bold ${isRec ? "text-white" : "text-foreground"}`}>
                  {o.label.split(" — ")[1] || o.label}
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${isRec ? "text-blue-100" : "text-muted-foreground"}`}>
                  {o.rationale}
                </p>
              </div>

              {/* Component checklist */}
              <div className="px-5 pb-4 flex-1">
                <div className="space-y-2">
                  {o.components.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <svg
                        className={`w-4 h-4 mt-0.5 shrink-0 ${isRec ? "text-blue-200" : "text-blue-600"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${isRec ? "text-blue-50" : "text-foreground"}`}>
                        {c.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price / payback */}
              <div className={`px-5 pb-3 ${isRec ? "border-t border-blue-500/40" : "border-t"} pt-4`}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className={`text-xs ${isRec ? "text-blue-200" : "text-muted-foreground"}`}>
                      Est. after subsidies
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {fmt(priceAfterSubsidy)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs ${isRec ? "text-blue-200" : "text-muted-foreground"}`}>
                      Payback
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {o.payback_years} years
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly payment */}
              <div className={`mx-5 mb-5 rounded-lg px-4 py-2.5 flex items-center justify-between ${
                isRec ? "bg-blue-700/60" : "bg-muted/50"
              }`}>
                <span className={`text-sm font-medium ${isRec ? "text-blue-100" : "text-muted-foreground"}`}>
                  Monthly payment
                </span>
                <span className="text-sm font-bold tabular-nums">
                  from {fmt(monthly)} /mo
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
