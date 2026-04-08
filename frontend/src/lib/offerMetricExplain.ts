/** Short fallbacks when enrichment is missing or a builder branch is unreachable. */

export const sectionTitleFallback = `This table shows numbers as stored in the briefing. When you move the usage slider on the offer cards, the app saves your annual kWh to the server and refreshes these figures after a short delay so they stay aligned.`;

const compareRowFallbackByKey: Record<string, string> = {
  systemSize: `Peak DC capacity in kilowatts. Sourced from roof analysis and tier caps.`,
  annualProduction: `Estimated kWh/yr from PVGIS yield per kWp and roof geometry, scaled if capped.`,
  selfConsumption: `Self-use % from the briefing model, using the lead’s annual electricity usage (slider / form).`,
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
