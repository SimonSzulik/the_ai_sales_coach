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
    self_consumption_pct: number;
    annual_production_kwh: number;
    roof_utilization_pct: number;
    system_kwp: number;
  };
  financing: Financing[];
}

interface Props {
  offers: OfferData[];
  name: string;
  onShowFinancing?: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function HouseIllustration({ tier }: { tier: string }) {
  const isRec = tier === "recommended";
  const isPrem = tier === "premium";
  const roofColor = isRec ? "#93c5fd" : isPrem ? "#c4b5fd" : "#86efac";
  const panelColor = isRec ? "#3b82f6" : isPrem ? "#8b5cf6" : "#22c55e";
  const wallColor = isRec ? "#e0f2fe" : isPrem ? "#f5f3ff" : "#f0fdf4";

  return (
    <svg viewBox="0 0 280 160" className="w-full h-32" fill="none">
      {/* Sky gradient */}
      <rect width="280" height="160" rx="8" fill={isRec ? "#1e40af" : "#f8fafc"} opacity={isRec ? 0.1 : 1} />
      {/* Ground */}
      <rect y="130" width="280" height="30" fill={isRec ? "#1e3a5f" : "#e2e8f0"} opacity={0.3} />
      {/* House body */}
      <rect x="60" y="70" width="120" height="60" rx="2" fill={wallColor} stroke={isRec ? "#60a5fa" : "#cbd5e1"} strokeWidth="1.5" />
      {/* Roof */}
      <polygon points="50,72 120,25 190,72" fill={roofColor} stroke={isRec ? "#60a5fa" : "#94a3b8"} strokeWidth="1.5" />
      {/* Solar panels on roof */}
      <rect x="75" y="42" width="28" height="16" rx="1" fill={panelColor} opacity="0.9" />
      <rect x="107" y="42" width="28" height="16" rx="1" fill={panelColor} opacity="0.9" />
      {isPrem && <rect x="139" y="48" width="20" height="12" rx="1" fill={panelColor} opacity="0.7" />}
      {/* Panel grid lines */}
      <line x1="89" y1="42" x2="89" y2="58" stroke="white" strokeWidth="0.5" opacity="0.6" />
      <line x1="75" y1="50" x2="103" y2="50" stroke="white" strokeWidth="0.5" opacity="0.6" />
      <line x1="121" y1="42" x2="121" y2="58" stroke="white" strokeWidth="0.5" opacity="0.6" />
      <line x1="107" y1="50" x2="135" y2="50" stroke="white" strokeWidth="0.5" opacity="0.6" />
      {/* Door */}
      <rect x="108" y="95" width="24" height="35" rx="2" fill={isRec ? "#60a5fa" : "#94a3b8"} opacity="0.6" />
      {/* Windows */}
      <rect x="72" y="82" width="22" height="18" rx="2" fill={isRec ? "#93c5fd" : "#bfdbfe"} opacity="0.7" />
      <rect x="146" y="82" width="22" height="18" rx="2" fill={isRec ? "#93c5fd" : "#bfdbfe"} opacity="0.7" />
      {/* Battery (for recommended/premium) */}
      {(isRec || isPrem) && (
        <g>
          <rect x="200" y="100" width="24" height="30" rx="3" fill={panelColor} opacity="0.7" />
          <rect x="207" y="96" width="10" height="5" rx="1" fill={panelColor} opacity="0.5" />
          <line x1="212" y1="108" x2="212" y2="118" stroke="white" strokeWidth="1.5" opacity="0.8" />
          <line x1="207" y1="113" x2="217" y2="113" stroke="white" strokeWidth="1.5" opacity="0.8" />
        </g>
      )}
      {/* Heat pump (premium only) */}
      {isPrem && (
        <g>
          <rect x="22" y="108" width="28" height="22" rx="3" fill="#a78bfa" opacity="0.6" />
          <circle cx="36" cy="119" r="6" fill="none" stroke="white" strokeWidth="1" opacity="0.7" />
          <path d="M33 119 L36 116 L39 119 L36 122 Z" fill="white" opacity="0.5" />
        </g>
      )}
      {/* Sun */}
      <circle cx="240" cy="30" r="14" fill="#fbbf24" opacity={isRec ? 0.6 : 0.4} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={240 + Math.cos(rad) * 18}
            y1={30 + Math.sin(rad) * 18}
            x2={240 + Math.cos(rad) * 22}
            y2={30 + Math.sin(rad) * 22}
            stroke="#fbbf24"
            strokeWidth="1.5"
            opacity={isRec ? 0.5 : 0.3}
          />
        );
      })}
    </svg>
  );
}

const tierConfig: Record<string, { badge1: string; badge2: string; badge1Variant: "outline" | "default"; badge2Variant: "outline" | "secondary" | "default" }> = {
  starter: { badge1: "BASIC", badge2: "Requested", badge1Variant: "outline", badge2Variant: "secondary" },
  recommended: { badge1: "BEST CHOICE", badge2: "RECOMMENDED", badge1Variant: "default", badge2Variant: "default" },
  premium: { badge1: "PREMIUM", badge2: "Long-term", badge1Variant: "outline", badge2Variant: "secondary" },
};

export default function OfferCards({ offers, name, onShowFinancing }: Props) {
  const firstName = name.split(" ")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Tailored offers for {firstName}</h2>
          <p className="text-sm text-muted-foreground">Three solutions. One clear recommendation.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Show prices
          </Badge>
          <button className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
            Compare
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
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
              className={`relative rounded-2xl border flex flex-col overflow-hidden transition-all ${
                isRec
                  ? "bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/20 ring-2 ring-blue-600/30 scale-[1.02]"
                  : "bg-card border-border shadow-sm hover:shadow-md"
              }`}
            >
              {/* Badges */}
              <div className="flex items-center gap-2 px-5 pt-4 pb-1">
                {isRec ? (
                  <>
                    <Badge className="bg-blue-800 text-white border-0 text-xs gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {config.badge1}
                    </Badge>
                    <Badge className="bg-white text-blue-600 border-0 text-xs font-semibold">
                      {config.badge2}
                    </Badge>
                  </>
                ) : (
                  <>
                    <Badge variant={config.badge1Variant} className="text-xs">
                      {config.badge1}
                    </Badge>
                    <Badge variant={config.badge2Variant} className="text-xs">
                      {config.badge2}
                    </Badge>
                  </>
                )}
              </div>

              {/* Title + subtitle */}
              <div className="px-5 pb-2">
                <h3 className={`text-lg font-bold ${isRec ? "text-white" : "text-foreground"}`}>
                  {o.label.split(" — ")[1] || o.label}
                </h3>
                <p className={`text-xs mt-0.5 leading-relaxed ${isRec ? "text-blue-100" : "text-muted-foreground"}`}>
                  {o.rationale.length > 80 ? o.rationale.slice(0, 80) + "..." : o.rationale}
                </p>
              </div>

              {/* Key stats bar */}
              <div className={`mx-5 mb-2 grid grid-cols-3 gap-2 rounded-lg px-3 py-2 text-center ${
                isRec ? "bg-blue-700/40" : "bg-muted/40"
              }`}>
                <div>
                  <div className={`text-base font-bold tabular-nums ${isRec ? "text-white" : "text-foreground"}`}>
                    {o.system_kwp.toFixed(1)}
                  </div>
                  <div className={`text-[10px] ${isRec ? "text-blue-200" : "text-muted-foreground"}`}>kWp</div>
                </div>
                <div>
                  <div className={`text-base font-bold tabular-nums ${isRec ? "text-white" : "text-foreground"}`}>
                    {new Intl.NumberFormat("de-DE").format(Math.round(o.annual_production_kwh))}
                  </div>
                  <div className={`text-[10px] ${isRec ? "text-blue-200" : "text-muted-foreground"}`}>kWh/yr</div>
                </div>
                <div>
                  <div className={`text-base font-bold tabular-nums ${isRec ? "text-white" : "text-foreground"}`}>
                    {Math.round(o.self_consumption_pct)}%
                  </div>
                  <div className={`text-[10px] ${isRec ? "text-blue-200" : "text-muted-foreground"}`}>self-use</div>
                </div>
              </div>

              {/* House illustration */}
              <div className={`mx-4 rounded-xl overflow-hidden ${isRec ? "bg-blue-700/30" : "bg-muted/30"}`}>
                <HouseIllustration tier={o.tier} />
              </div>

              {/* Component checklist */}
              <div className="px-5 py-3 flex-1">
                <div className="space-y-2">
                  {o.components.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <svg
                        className={`w-4 h-4 mt-0.5 shrink-0 ${isRec ? "text-blue-200" : "text-blue-600"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                        <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5} />
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
              <div className={`mx-5 rounded-lg px-4 py-2.5 flex items-center justify-between flex-wrap gap-1 ${
                isRec ? "bg-blue-700/60" : "bg-muted/50"
              }`}>
                <span className={`text-sm font-medium ${isRec ? "text-blue-100" : "text-muted-foreground"}`}>
                  Monthly payment
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    from {fmt(monthly)} /mo
                  </span>
                  {isRec && (
                    <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                      {Math.round(o.self_consumption_pct)}% self-use
                    </span>
                  )}
                </div>
              </div>

              {/* See financing link */}
              <button
                onClick={onShowFinancing}
                className={`mx-5 mb-5 mt-3 text-sm font-medium flex items-center gap-1 ${
                  isRec ? "text-blue-100 hover:text-white" : "text-blue-600 hover:text-blue-700"
                } transition-colors`}
              >
                See financing options
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
