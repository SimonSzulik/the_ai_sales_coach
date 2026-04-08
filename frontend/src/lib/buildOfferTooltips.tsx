import type { ReactNode } from "react";
import {
  BATTERY_KWH_SHIFT_PER_KWH_PACK,
  CO2_KG_PER_KWH_GRID,
  DEGRADATION_YEARLY,
  FEED_IN_TARIFF_EUR,
  HEAT_PUMP_LOAD_KWH,
  HEAT_PUMP_SAVINGS_EUR,
  HOUSEHOLD_DEFAULT_KWH,
  MAX_PREM_KWP,
  MAX_REC_KWP,
  MAX_STARTER_KWP,
  PANEL_KW_PER_M2,
} from "@/lib/offerCalcConstants";
import { compareRowFallbackLine, sectionTitleFallback } from "@/lib/offerMetricExplain";

/** Loose shape for `briefing.enrichment` (see `page.tsx`). */
export type EnrichmentInput = {
  geo?: { data?: Record<string, unknown> };
  solar?: { data?: Record<string, unknown> };
  energy?: { data?: Record<string, unknown> };
  subsidies?: { data?: Record<string, unknown> };
  market_context?: { data?: Record<string, unknown> };
  roof_analysis?: { data?: Record<string, unknown> };
};

export type OfferRow = {
  tier: string;
  label: string;
  rationale: string;
  capex_eur: number;
  annual_savings_eur: number;
  payback_years: number;
  co2_saved_kg: number;
  self_consumption_pct: number;
  annual_production_kwh: number;
  roof_utilization_pct: number;
  system_kwp: number;
  battery_kwh: number;
  retail_price_eur_kwh: number;
  feed_in_tariff_eur: number;
  has_heat_pump: boolean;
};

/** Full offer row (cards + slider). */
export type OfferBundle = {
  offer: OfferRow;
  financing: { subsidy_deducted_eur: number }[];
};

/** Minimal offer shape for compare-table tooltips (matches `CompareNumbers`). */
export type CompareOfferBundle = {
  offer: Pick<
    OfferRow,
    | "tier"
    | "system_kwp"
    | "annual_production_kwh"
    | "self_consumption_pct"
    | "capex_eur"
    | "annual_savings_eur"
    | "payback_years"
    | "co2_saved_kg"
    | "roof_utilization_pct"
  >;
  financing: { subsidy_deducted_eur: number }[];
};

export type CompareRowKey =
  | "systemSize"
  | "annualProduction"
  | "selfConsumption"
  | "gridIndependence"
  | "upfront"
  | "annualSavings"
  | "payback"
  | "co2Saved"
  | "roofUtilization"
  | "twentyYearSavings";

export type SliderSim = {
  scPct: number;
  savings: number;
  payback: number;
  co2: number;
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

const fmtInt = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);

function tierCapKwp(tier: string): number {
  if (tier === "starter") return MAX_STARTER_KWP;
  if (tier === "recommended") return MAX_REC_KWP;
  if (tier === "premium") return MAX_PREM_KWP;
  return MAX_STARTER_KWP;
}

/** Same logic as `OfferCards` `recalcSelfConsumption` — keep in sync. */
export function recalcSelfConsumption(
  annualKwh: number,
  batteryKwh: number,
  hasHeatPump: boolean,
  householdKwh: number,
): number {
  const consumption = householdKwh + (hasHeatPump ? HEAT_PUMP_LOAD_KWH : 0);
  if (annualKwh <= 0) return 0;
  const baseSc = Math.min(0.3, consumption / annualKwh);
  const batteryBoost = (batteryKwh * BATTERY_KWH_SHIFT_PER_KWH_PACK) / annualKwh;
  const hpBoost = hasHeatPump ? 0.08 : 0;
  const cap = hasHeatPump ? 0.9 : batteryKwh > 0 ? 0.75 : 0.4;
  return Math.min(baseSc + batteryBoost + hpBoost, cap);
}

export function recalcSavings(
  annualKwh: number,
  scRate: number,
  retailPrice: number,
  feedInTariff: number,
  hasHeatPump: boolean,
): number {
  const selfConsumed = annualKwh * scRate;
  const exported = annualKwh - selfConsumed;
  const hpSavings = hasHeatPump ? HEAT_PUMP_SAVINGS_EUR : 0;
  return selfConsumed * retailPrice + exported * feedInTariff + hpSavings;
}

function roofDataBlock(roof: Record<string, unknown> | undefined): ReactNode {
  if (!roof) {
    return <p className="text-muted-foreground">No roof analysis in this briefing — sizing uses backend fallbacks.</p>;
  }
  const err = roof.error;
  if (err != null && String(err).length > 0) {
    return <p>Roof analysis reported an issue: {String(err)}. Offer sizing may use defaults.</p>;
  }
  const planes = roof.planes as Array<Record<string, unknown>> | undefined;
  const totalM2 = roof.total_roof_area_m2 as number | undefined;
  const totalKwp = roof.total_estimated_kwp as number | undefined;
  const addr = roof.address as string | undefined;

  return (
    <div className="space-y-1.5">
      {addr ? <p className="text-[11px] text-muted-foreground">Address: {addr}</p> : null}
      <p>
        <span className="font-medium">Roof summary:</span>{" "}
        {planes?.length != null ? `${planes.length} plane(s)` : "planes n/a"}
        {totalM2 != null ? ` · total roof ≈ ${fmtInt(totalM2)} m²` : ""}
        {totalKwp != null ? ` · roof-estimated kWp ≈ ${totalKwp.toFixed(1)}` : ""}.
      </p>
      {planes && planes.length > 0 ? (
        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
          {planes.slice(0, 8).map((p, i) => (
            <li key={i}>
              Plane {i + 1}: tilt {String(p.tilt_deg ?? "—")}°, azimuth {String(p.azimuth_deg ?? "—")}°, area{" "}
              {p.area_m2 != null ? `${fmtInt(Number(p.area_m2))} m²` : "—"}, suitability {String(p.suitability ?? "—")}
              {p.estimated_kwp != null ? `, ~${Number(p.estimated_kwp).toFixed(2)} kWp` : ""}
            </li>
          ))}
          {planes.length > 8 ? <li>… and {planes.length - 8} more.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function tierNarrative(tier: string): string {
  if (tier === "starter") {
    return "Starter uses the best high-suitability plane first, then caps at the starter tier maximum.";
  }
  if (tier === "recommended") {
    return "Recommended aggregates high + medium suitability planes and adds a battery sized with the ~1.2× kWp rule (capped by tier).";
  }
  if (tier === "premium") {
    return "Premium uses the same plane set as Recommended with a higher tier cap, larger battery (~1.5× kWp), wallbox, and optional heat-pump package when not already installed.";
  }
  return "Offer tier sizing follows the backend roof + cap rules.";
}

export function buildTierCardTooltipContent(
  tier: string,
  offer: OfferRow,
  enrichment: EnrichmentInput | undefined,
): ReactNode {
  const roof = enrichment?.roof_analysis?.data as Record<string, unknown> | undefined;
  const solar = enrichment?.solar?.data as Record<string, unknown> | undefined;
  const geo = enrichment?.geo?.data as Record<string, unknown> | undefined;
  const energy = enrichment?.energy?.data as Record<string, unknown> | undefined;
  const subsidies = enrichment?.subsidies?.data as Record<string, unknown> | undefined;
  const market = enrichment?.market_context?.data as Record<string, unknown> | undefined;

  const annualYield = solar?.annual_kwh_per_kwp as number | undefined;
  const optAngle = solar?.optimal_angle;
  const optAz = solar?.optimal_azimuth;
  const lat = geo?.latitude as number | undefined;
  const lon = geo?.longitude as number | undefined;
  const city = (geo?.city ?? geo?.display_name) as string | undefined;
  const retailBrief = energy?.retail_price_eur_kwh as number | undefined;
  const subsidyPot = subsidies?.total_potential_eur as number | undefined;

  const cap = tierCapKwp(tier);
  const buildingProfile = market?.building_profile as Record<string, unknown> | undefined;
  const localUtility = market?.local_utility as Record<string, unknown> | undefined;
  const bType = buildingProfile?.building_type as string | undefined;
  const utilName = localUtility?.name as string | undefined;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-foreground">Data sources</p>
        {roofDataBlock(roof)}
      </div>

      <div>
        <p className="font-semibold text-foreground">PVGIS site reference</p>
        <p className="text-[11px] text-muted-foreground">
          Annual kWh per kWp here is the EU PVGIS reference for your coordinates, not a measured roof value. Production on
          each plane applies a Germany-style tilt/azimuth correction (interpolated lookup by bucket — same idea as the
          backend).
        </p>
        {annualYield != null ? (
          <p>
            Reference yield: <code className="text-[11px]">{fmtInt(annualYield)} kWh/kWp·yr</code>
            {optAngle != null && optAz != null ? (
              <>
                {" "}
                (PVGIS optimal plane: {String(optAngle)}° tilt, {String(optAz)}° azimuth)
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">Solar yield not present in enrichment.</p>
        )}
        {(lat != null && lon != null) || city ? (
          <p className="text-[11px]">
            Geo: {city ? `${city} · ` : ""}
            {lat != null && lon != null ? `${lat.toFixed(4)}°, ${lon.toFixed(4)}°` : ""}
          </p>
        ) : null}
      </div>

      <div>
        <p className="font-semibold text-foreground">Tier logic</p>
        <p>{tierNarrative(tier)}</p>
        <p>
          Residential cap for this tier: <strong>{cap} kWp</strong>. If uncapped kWp would exceed this, production
          scales down proportionally.
        </p>
      </div>

      <div>
        <p className="font-semibold text-foreground">This card&apos;s metrics</p>
        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
          <li>
            Retail (card): {fmtEur(offer.retail_price_eur_kwh ?? 0)}/kWh
            {retailBrief != null ? ` · briefing energy enricher: ${fmtEur(retailBrief)}/kWh` : ""}
          </li>
          <li>Feed-in: {fmtEur(offer.feed_in_tariff_eur ?? FEED_IN_TARIFF_EUR)}/kWh (default model {FEED_IN_TARIFF_EUR})</li>
          <li>Battery: {fmtInt(offer.battery_kwh ?? 0)} kWh</li>
          <li>Heat pump in package (model flag): {offer.has_heat_pump ? "yes" : "no"}</li>
        </ul>
        {subsidyPot != null ? (
          <p className="text-[11px] mt-1">
            Subsidies enricher (potential): <strong>{fmtEur(subsidyPot)}</strong> total — financing row uses catalog
            deductions separately.
          </p>
        ) : null}
        {(bType || utilName) && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {bType ? `Building: ${bType}. ` : ""}
            {utilName ? `Local utility (context): ${utilName}.` : ""}
          </p>
        )}
      </div>

      <div>
        <p className="font-semibold text-foreground">Usage slider</p>
        <p className="text-[11px]">
          Moving &quot;Your annual electricity usage&quot; recalculates self-use %, savings, payback, and CO₂ on the
          cards using the formulas below. kWp and annual kWh/yr stay fixed from the briefing.
        </p>
      </div>
    </div>
  );
}

export function buildSliderTooltipContent(
  offer: OfferRow,
  householdKwh: number,
  sim: SliderSim,
): ReactNode {
  const annual = offer.annual_production_kwh;
  const bat = offer.battery_kwh ?? 0;
  const hp = offer.has_heat_pump ?? false;
  const retail = offer.retail_price_eur_kwh ?? 0.35;
  const feed = offer.feed_in_tariff_eur ?? FEED_IN_TARIFF_EUR;

  const consumption = householdKwh + (hp ? HEAT_PUMP_LOAD_KWH : 0);
  const baseSc = annual > 0 ? Math.min(0.3, consumption / annual) : 0;
  const batteryBoost = annual > 0 ? (bat * BATTERY_KWH_SHIFT_PER_KWH_PACK) / annual : 0;
  const hpBoost = hp ? 0.08 : 0;
  const cap = hp ? 0.9 : bat > 0 ? 0.75 : 0.4;
  const scRaw = Math.min(baseSc + batteryBoost + hpBoost, cap);
  const sc = recalcSelfConsumption(annual, bat, hp, householdKwh);

  const selfKwh = annual * sc;
  const expKwh = annual - selfKwh;
  const hpEur = hp ? HEAT_PUMP_SAVINGS_EUR : 0;
  const savingsCalc = recalcSavings(annual, sc, retail, feed, hp);

  return (
    <div className="space-y-2">
      <p className="font-semibold">Example walkthrough (recommended / example tier)</p>
      <p className="text-[11px] text-muted-foreground">
        Values below use this offer&apos;s production ({fmtInt(annual)} kWh/yr), battery ({fmtInt(bat)} kWh), heat pump
        flag ({hp ? "on" : "off"}), and your slider: {fmtInt(householdKwh)} kWh/yr household.
      </p>

      <div className="space-y-1 text-[11px]">
        <p>
          <span className="font-medium">1. Effective consumption</span> = {fmtInt(householdKwh)}
          {hp ? ` + ${fmtInt(HEAT_PUMP_LOAD_KWH)} (HP load)` : ""} = <strong>{fmtInt(consumption)} kWh/yr</strong>
        </p>
        <p>
          <span className="font-medium">2. Base self-consumption rate</span> = min(30%, consumption ÷ production) = min(0.30,{" "}
          {consumption}/{annual}) ≈ {(baseSc * 100).toFixed(1)}%
        </p>
        <p>
          <span className="font-medium">3. Battery boost</span> = (battery_kWh × {BATTERY_KWH_SHIFT_PER_KWH_PACK}) ÷ production = (
          {bat} × {BATTERY_KWH_SHIFT_PER_KWH_PACK}) ÷ {annual} ≈ {(batteryBoost * 100).toFixed(1)} pp
        </p>
        {hp ? (
          <p>
            <span className="font-medium">4. Heat-pump boost</span> = +8 pp (capped with base + battery)
          </p>
        ) : null}
        <p>
          <span className="font-medium">{hp ? "5" : "4"}. Cap</span> = {hp ? "90% (HP)" : bat > 0 ? "75% (battery)" : "40% (solar only)"}{" "}
          → raw sum ≈ {(scRaw * 100).toFixed(1)}% → <strong>{sim.scPct}%</strong> (rounded, matches {(sc * 100).toFixed(2)}%)
        </p>
      </div>

      <div className="space-y-1 text-[11px] border-t border-border pt-2">
        <p>
          <span className="font-medium">Savings (yr 1)</span> = self kWh × retail + export kWh × feed-in + HP bonus
        </p>
        <p className="font-mono text-[10px] break-all">
          = {fmtInt(selfKwh)} × {retail.toFixed(3)} + {fmtInt(expKwh)} × {feed.toFixed(3)}
          {hpEur > 0 ? ` + ${fmtInt(hpEur)}` : ""} ≈ {fmtEur(savingsCalc)} ≈ <strong>{fmtEur(sim.savings)}</strong> (rounded)
        </p>
        <p>
          <span className="font-medium">Payback</span> = capex ÷ annual savings
          {sim.savings > 0 ? (
            <>
              {" "}
              = {fmtEur(offer.capex_eur)} ÷ {fmtEur(sim.savings)} → <strong>{sim.payback} yr</strong>
            </>
          ) : (
            <> → use card payback when savings ≈ 0</>
          )}
        </p>
        <p>
          <span className="font-medium">CO₂ (card model)</span> = production × self-use × {CO2_KG_PER_KWH_GRID} kg/kWh →{" "}
          <strong>{fmtInt(sim.co2)} kg/yr</strong> (note: briefing table may use backend CO₂ including premium extras)
        </p>
      </div>
    </div>
  );
}

function twentyYearSum(annual: number): number {
  let t = 0;
  for (let y = 0; y < 20; y++) t += annual * Math.pow(DEGRADATION_YEARLY, y);
  return t;
}

export function buildCompareSectionTitleContent(enrichment: EnrichmentInput | undefined): ReactNode {
  const solar = enrichment?.solar?.data as Record<string, unknown> | undefined;
  const geo = enrichment?.geo?.data as Record<string, unknown> | undefined;
  const roof = enrichment?.roof_analysis?.data as Record<string, unknown> | undefined;
  const annualYield = solar?.annual_kwh_per_kwp as number | undefined;
  const city = (geo?.city ?? geo?.display_name) as string | undefined;
  const planes = roof?.planes as unknown[] | undefined;

  if (!enrichment || (!annualYield && !planes?.length && !city)) {
    return <span className="whitespace-pre-line">{sectionTitleFallback}</span>;
  }

  return (
    <div className="space-y-2">
      <p>{sectionTitleFallback}</p>
      <p className="text-[11px] text-muted-foreground">
        Briefing snapshot: default household model <strong>{fmtInt(HOUSEHOLD_DEFAULT_KWH)} kWh/yr</strong> (not the
        slider).
      </p>
      {annualYield != null ? (
        <p className="text-[11px]">
          PVGIS reference yield in briefing: <strong>{fmtInt(annualYield)} kWh/kWp·yr</strong>
        </p>
      ) : null}
      {city ? <p className="text-[11px]">Location context: {city}</p> : null}
      {planes && planes.length > 0 ? (
        <p className="text-[11px]">
          Roof analysis: <strong>{planes.length}</strong> plane(s) in briefing data.
        </p>
      ) : null}
    </div>
  );
}

export function buildCompareRowContent(
  key: CompareRowKey,
  example: CompareOfferBundle,
  _enrichment: EnrichmentInput | undefined,
): ReactNode {
  const o = example.offer;
  const subsidy = example.financing[0]?.subsidy_deducted_eur ?? 0;
  const upfront = Math.max(0, o.capex_eur - subsidy);
  const selfFrac = o.self_consumption_pct / 100;
  const selfKwh = o.annual_production_kwh * selfFrac;
  const gridPct = Math.min(100, Math.round((selfKwh / HOUSEHOLD_DEFAULT_KWH) * 100));
  const twenty = twentyYearSum(o.annual_savings_eur);
  const panelArea = o.system_kwp / PANEL_KW_PER_M2;

  const formula = (body: ReactNode) => (
    <div className="space-y-2">
      {body}
      <p className="text-[11px] font-medium text-foreground border-t border-border pt-2">Example (recommended or first tier)</p>
      <p className="text-[11px] text-muted-foreground">
        Tier: <strong>{o.tier}</strong> — numbers below are from this column&apos;s briefing values, not the usage slider.
      </p>
    </div>
  );

  switch (key) {
    case "systemSize":
      return formula(
        <>
          <p>Peak DC capacity (kWp). From roof planes (estimated kWp per plane), aggregated for the tier, then limited by tier caps ({MAX_STARTER_KWP} / {MAX_REC_KWP} / {MAX_PREM_KWP} kWp).</p>
          <p className="text-[11px] font-mono">Example: system_kwp = {o.system_kwp.toFixed(1)} kWp</p>
        </>,
      );
    case "annualProduction":
      return formula(
        <>
          <p>
            For each plane: kWp × PVGIS kWh/kWp × tilt/azimuth factor; summed and scaled if capped. Full PVGIS tilt table
            is interpolated in the backend (not duplicated here).
          </p>
          <p className="text-[11px] font-mono">Example: annual_production_kwh = {fmtInt(o.annual_production_kwh)} kWh/yr</p>
        </>,
      );
    case "selfConsumption":
      return formula(
        <>
          <p>Backend self-use % using default household ({fmtInt(HOUSEHOLD_DEFAULT_KWH)} kWh), HP add-on, battery boost, and caps — not the interactive slider.</p>
          <p className="text-[11px] font-mono">Example: self_consumption_pct = {Math.round(o.self_consumption_pct)}%</p>
        </>,
      );
    case "gridIndependence":
      return formula(
        <>
          <p>Illustrative share of fixed annual demand ({fmtInt(HOUSEHOLD_DEFAULT_KWH)} kWh) covered by self-consumed solar:</p>
          <p className="text-[11px] font-mono">min(100, round(production × self% ÷ {HOUSEHOLD_DEFAULT_KWH} × 100))</p>
          <p className="text-[11px] font-mono">
            = min(100, round({fmtInt(selfKwh)} ÷ {HOUSEHOLD_DEFAULT_KWH} × 100)) = {gridPct}%
          </p>
        </>,
      );
    case "upfront":
      return formula(
        <>
          <p>Package capex minus the first financing scenario&apos;s subsidy deduction (after subsidies).</p>
          <p className="text-[11px] font-mono">
            max(0, capex_eur − subsidy) = max(0, {fmtInt(o.capex_eur)} − {fmtInt(subsidy)}) = {fmtEur(upfront)}
          </p>
        </>,
      );
    case "annualSavings":
      return formula(
        <>
          <p>Year-one savings from briefing: self kWh × retail + export × feed-in + fixed premium add-ons (e.g. heat pump €{fmtInt(HEAT_PUMP_SAVINGS_EUR)}/yr when modeled).</p>
          <p className="text-[11px] font-mono">Example: annual_savings_eur = {fmtEur(o.annual_savings_eur)}</p>
        </>,
      );
    case "payback":
      return formula(
        <>
          <p>Simple payback: capex ÷ annual savings (briefing).</p>
          <p className="text-[11px] font-mono">
            Example: payback_years = {o.payback_years} (from {fmtInt(o.capex_eur)} ÷ {fmtInt(o.annual_savings_eur)}-class savings)
          </p>
        </>,
      );
    case "co2Saved":
      return formula(
        <>
          <p>
            Starter/Recommended: ≈ self-consumed kWh × {CO2_KG_PER_KWH_GRID} kg/kWh. Premium backend may add an extra
            avoided-heating term when a heat pump is modeled (see server offers builder).
          </p>
          <p className="text-[11px] font-mono">Example: co2_saved_kg = {fmtInt(o.co2_saved_kg)} kg/yr</p>
        </>,
      );
    case "roofUtilization":
      return formula(
        <>
          <p>Panel area ≈ kWp ÷ {PANEL_KW_PER_M2} kW/m²; divided by total roof area from analysis.</p>
          <p className="text-[11px] font-mono">
            Example: panel area ≈ {o.system_kwp.toFixed(2)} ÷ {PANEL_KW_PER_M2} ≈ {fmtInt(panelArea)} m² → roof_utilization_pct ={" "}
            {o.roof_utilization_pct > 0 ? `${Math.round(o.roof_utilization_pct)}%` : "—"}
          </p>
        </>,
      );
    case "twentyYearSavings":
      return formula(
        <>
          <p>
            Sum of annual savings × ({DEGRADATION_YEARLY})^y for y = 0…19 (geometric series; ~0.5% degradation per year).
          </p>
          <p className="text-[11px] font-mono">
            Example: Σ = {fmtInt(Math.round(twenty))} (from annual_savings_eur = {fmtInt(o.annual_savings_eur)})
          </p>
        </>,
      );
    default:
      return <p>{compareRowFallbackLine(key)}</p>;
  }
}
