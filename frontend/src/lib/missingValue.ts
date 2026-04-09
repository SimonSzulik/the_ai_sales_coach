/** Single-underscore sentinel for unknown/missing string fields from enrichers. */
export const MISSING_STRING = "_" as const;

/** Legacy sentinels still accepted when reading older briefings. */
const LEGACY_MISSING = new Set(["NAV", "nav", "NA", "na", "n/a", "N/A"]);

export function isMissingString(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t === "" || t === MISSING_STRING || LEGACY_MISSING.has(t);
}

/** OSINT / categorical fields: map unknown or legacy sentinels to `"_"`. */
export function normalizeEvStatus(v: string | undefined | null): "yes" | "no" | "_" {
  if (v === "yes" || v === "no") return v;
  return "_";
}
