"use client";

interface OfferData {
  offer: {
    tier: string;
    system_kwp: number;
    annual_production_kwh: number;
    self_consumption_pct: number;
    annual_savings_eur: number;
    payback_years: number;
    capex_eur: number;
    co2_saved_kg: number;
    roof_utilization_pct: number;
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

function buildReasons(offers: OfferData[]) {
  const rec = offers.find((o) => o.offer.tier === "recommended");
  const starter = offers.find((o) => o.offer.tier === "starter");
  const premium = offers.find((o) => o.offer.tier === "premium");

  if (!rec) return [];

  const reasons: { icon: React.ReactNode; title: string; description: string }[] = [];

  const savingsVsStarter = rec.offer.annual_savings_eur - (starter?.offer.annual_savings_eur ?? 0);
  const savingsPerEuro = rec.offer.annual_savings_eur / rec.offer.capex_eur;
  const premSavingsPerEuro = premium
    ? premium.offer.annual_savings_eur / premium.offer.capex_eur
    : 0;

  reasons.push({
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Best return on investment",
    description:
      savingsPerEuro > premSavingsPerEuro
        ? `Earns ${(savingsPerEuro * 100).toFixed(1)} cents per euro invested annually — the highest ROI of all three options.`
        : `${fmt(rec.offer.annual_savings_eur)} annual savings with a ${rec.offer.payback_years}-year payback, the best balance of cost and returns.`,
  });

  reasons.push({
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: `${Math.round(rec.offer.self_consumption_pct)}% energy independence`,
    description: `Battery storage lets you use ${Math.round(
      rec.offer.self_consumption_pct
    )}% of your own solar energy — ${Math.round(
      rec.offer.self_consumption_pct - (starter?.offer.self_consumption_pct ?? 30)
    )} percentage points more than solar-only, protecting you from rising grid prices.`,
  });

  const recPlanes = rec.offer.roof_utilization_pct;
  if (recPlanes > 0 && starter) {
    reasons.push({
      icon: (
        <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      title: "Optimal roof utilization",
      description: `Uses ${Math.round(recPlanes)}% of your roof area with the best-suited planes — ${rec.offer.system_kwp.toFixed(1)} kWp producing ${new Intl.NumberFormat("de-DE").format(Math.round(rec.offer.annual_production_kwh))} kWh per year.`,
    });
  } else {
    reasons.push({
      icon: (
        <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: `${fmt(savingsVsStarter)} more savings than starter`,
      description: `The battery shifts exported surplus into self-consumption, adding ${fmt(savingsVsStarter)} in annual savings compared to solar-only.`,
    });
  }

  return reasons;
}

export default function WhyRecommended({ offers }: Props) {
  const reasons = buildReasons(offers);

  if (reasons.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Why the recommended offer is the smartest choice</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {reasons.map((r, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 flex flex-col items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              {r.icon}
            </div>
            <div>
              <h4 className="text-sm font-semibold">{r.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
