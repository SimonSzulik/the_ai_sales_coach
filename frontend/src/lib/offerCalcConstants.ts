/**
 * Mirrors backend `app/engine/offers.py` for customer-facing explanations.
 * Keep in sync when changing server-side offer logic.
 */
export const HOUSEHOLD_DEFAULT_KWH = 4_000;
export const FEED_IN_TARIFF_EUR = 0.081;
export const CO2_KG_PER_KWH_GRID = 0.4;
/** Approx. kW per m² panel area — used for roof utilization (backend uses kwp / 0.18). */
export const PANEL_KW_PER_M2 = 0.18;
export const MAX_STARTER_KWP = 10;
export const MAX_REC_KWP = 15;
export const MAX_PREM_KWP = 20;
/** Year-over-year production factor in 20-year savings sum (CompareNumbers). */
export const DEGRADATION_YEARLY = 0.995;
/** Fixed illustrative heat-pump benefit in savings (premium), EUR/yr — backend. */
export const HEAT_PUMP_SAVINGS_EUR = 1_200;
/** Extra load modeled for heat pump in self-consumption (kWh/yr). */
export const HEAT_PUMP_LOAD_KWH = 3_000;
/** Battery: kWh shifted per kWh pack per year (rule of thumb in model). */
export const BATTERY_KWH_SHIFT_PER_KWH_PACK = 250;
