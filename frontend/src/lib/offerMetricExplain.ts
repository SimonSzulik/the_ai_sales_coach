/** Short fallbacks when enrichment is missing or a builder branch is unreachable. */

export const sectionTitleFallback = `This table shows numbers exactly as stored in the briefing (default household electricity model from the server, typically ~4,000 kWh/year). It does not follow the usage slider on the offer cards — if you change the slider, the cards can show different savings, payback, and self-use than this table.`;

const compareRowFallbackByKey: Record<string, string> = {
  systemSize: `Peak DC capacity in kilowatts. Sourced from roof analysis and tier caps.`,
  annualProduction: `Estimated kWh/yr from PVGIS yield per kWp and roof geometry, scaled if capped.`,
  selfConsumption: `Backend self-use % with default household — not the interactive slider.`,
  gridIndependence: `Share of a fixed annual household demand covered by self-consumed solar (capped at 100%).`,
  upfront: `Capital cost minus first financing scenario subsidy deduction.`,
  annualSavings: `Year-one savings from briefing (self × retail + export × feed-in + add-ons).`,
  payback: `Package cost ÷ annual savings from the briefing.`,
  co2Saved: `Approximate yearly CO₂ avoided via self-consumed solar (grid mix assumption); premium may differ.`,
  roofUtilization: `Panel area (kWp ÷ ~0.18 kW/m²) vs total roof area from analysis.`,
  twentyYearSavings: `Sum of annual savings over 20 years with ~0.5%/yr degradation.`,
};

export function compareRowFallbackLine(key: string): string {
  return compareRowFallbackByKey[key] ?? "Value from the briefing for this metric.";
}
