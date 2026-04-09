/** Single-underscore sentinel for unknown/missing string fields from enrichers (legacy: "NAV"). */
export const MISSING_STRING = "_" as const;

export function isMissingString(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t === "" || t === MISSING_STRING || t === "NAV";
}
