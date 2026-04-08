"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

interface OfferData {
  offer: {
    tier: string;
    label: string;
    capex_eur: number;
    annual_production_kwh: number;
    self_consumption_pct: number;
    annual_savings_eur: number;
    payback_years: number;
    co2_saved_kg: number;
    system_kwp: number;
    battery_kwh: number;
    retail_price_eur_kwh: number;
    feed_in_tariff_eur: number;
    has_heat_pump: boolean;
  };
  financing: { subsidy_deducted_eur: number }[];
}

interface Props {
  offers: OfferData[];
}

const CO2_PER_KWH = 0.4;
const DEFAULT_HOUSEHOLD = 4000;

function recalcSelfConsumption(
  annualKwh: number,
  batteryKwh: number,
  hasHeatPump: boolean,
  householdKwh: number,
): number {
  const consumption = householdKwh + (hasHeatPump ? 3000 : 0);
  if (annualKwh <= 0) return 0;
  const baseSc = Math.min(0.30, consumption / annualKwh);
  const batteryBoost = (batteryKwh * 250) / annualKwh;
  const hpBoost = hasHeatPump ? 0.08 : 0;
  const cap = hasHeatPump ? 0.90 : batteryKwh > 0 ? 0.75 : 0.40;
  return Math.min(baseSc + batteryBoost + hpBoost, cap);
}

function recalcSavings(
  annualKwh: number,
  scRate: number,
  retailPrice: number,
  feedInTariff: number,
  hasHeatPump: boolean,
): number {
  const selfConsumed = annualKwh * scRate;
  const exported = annualKwh - selfConsumed;
  const hpSavings = hasHeatPump ? 1200 : 0;
  return selfConsumed * retailPrice + exported * feedInTariff + hpSavings;
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function tierColor(tier: string) {
  if (tier === "recommended") return "text-blue-600";
  if (tier === "premium") return "text-purple-600";
  return "text-green-600";
}

function tierBg(tier: string) {
  if (tier === "recommended") return "bg-blue-50 border-blue-200";
  if (tier === "premium") return "bg-purple-50 border-purple-200";
  return "bg-green-50 border-green-200";
}

function tierLabel(tier: string) {
  if (tier === "starter") return "Starter";
  if (tier === "recommended") return "Recommended";
  return "Premium";
}

export default function SavingsSimulator({ offers }: Props) {
  const [household, setHousehold] = useState(DEFAULT_HOUSEHOLD);

  const simulated = useMemo(
    () =>
      offers.map(({ offer: o, financing }) => {
        const sc = recalcSelfConsumption(
          o.annual_production_kwh,
          o.battery_kwh,
          o.has_heat_pump,
          household,
        );
        const savings = recalcSavings(
          o.annual_production_kwh,
          sc,
          o.retail_price_eur_kwh,
          o.feed_in_tariff_eur,
          o.has_heat_pump,
        );
        const payback = savings > 0 ? o.capex_eur / savings : 99;
        const co2 = o.annual_production_kwh * sc * CO2_PER_KWH;
        const gridIndep = Math.min(100, (o.annual_production_kwh * sc) / household * 100);

        return {
          tier: o.tier,
          scPct: Math.round(sc * 100),
          savings: Math.round(savings),
          payback: Math.round(payback * 10) / 10,
          co2: Math.round(co2),
          gridIndep: Math.round(gridIndep),
          isDefault: household === DEFAULT_HOUSEHOLD,
        };
      }),
    [offers, household],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Energy usage simulator</CardTitle>
          <Badge variant="outline" className="text-xs">Interactive</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Adjust your household&apos;s annual electricity consumption to see how it affects each offer.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Annual household consumption</label>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {new Intl.NumberFormat("de-DE").format(household)} kWh
            </span>
          </div>
          <Slider
            min={1500}
            max={12000}
            step={250}
            value={[household]}
            onValueChange={(v) => {
              const val = Array.isArray(v) ? v[0] : v;
              setHousehold(val);
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1,500 kWh (single)</span>
            <span>4,000 kWh (avg.)</span>
            <span>12,000 kWh (large home)</span>
          </div>
        </div>

        {/* Results grid */}
        <div className="grid gap-3 sm:grid-cols-3">
          {simulated.map((s) => {
            const isRec = s.tier === "recommended";
            return (
              <div
                key={s.tier}
                className={`rounded-xl border p-4 space-y-3 transition-all ${tierBg(s.tier)} ${
                  isRec ? "ring-2 ring-blue-300" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${tierColor(s.tier)}`}>
                    {tierLabel(s.tier)}
                  </span>
                  {isRec && (
                    <Badge className="bg-blue-600 text-white border-0 text-[10px] px-1.5 py-0">Best</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Self-consumption</span>
                    <span className={`text-sm font-bold tabular-nums ${tierColor(s.tier)}`}>{s.scPct}%</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Grid independence</span>
                    <span className={`text-sm font-bold tabular-nums ${tierColor(s.tier)}`}>{s.gridIndep}%</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Annual savings</span>
                    <span className="text-sm font-bold tabular-nums">{fmt(s.savings)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Payback</span>
                    <span className="text-sm font-bold tabular-nums">{s.payback} yr</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">CO₂ saved</span>
                    <span className="text-sm font-bold tabular-nums">
                      {new Intl.NumberFormat("de-DE").format(s.co2)} kg/yr
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {household !== DEFAULT_HOUSEHOLD && (
          <p className="text-xs text-muted-foreground text-center">
            Default comparison assumes 4,000 kWh/yr.{" "}
            <button
              className="text-blue-600 hover:underline font-medium"
              onClick={() => setHousehold(DEFAULT_HOUSEHOLD)}
            >
              Reset to default
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
