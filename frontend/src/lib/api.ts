const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Local-only "ownership" tracking. Leads created in this browser are recorded
 * in localStorage; the dashboard then filters the global /api/leads list down
 * to just the ones this user actually generated. This is deliberately
 * client-side — no auth, no backend changes, just scoped visibility.
 */
const MY_LEADS_KEY = "my_lead_ids";

function readMyLeadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_LEADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rememberMyLeadId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const existing = new Set(readMyLeadIds());
    existing.add(id);
    window.localStorage.setItem(MY_LEADS_KEY, JSON.stringify(Array.from(existing)));
  } catch {
    // localStorage can throw in private-mode or when quota is exceeded; fail silently.
  }
}

export function getMyLeadIds(): string[] {
  return readMyLeadIds();
}

/**
 * Validates that an address + postal code resolves to a real street-level
 * location by calling the backend's Google Geocoding proxy (`/api/maps/validate-address`).
 *
 * The backend uses the same Google Maps API key that powers the roof
 * analyzer, so no additional cloud provider is introduced. Validation rules
 * (street-level component + matching postal code) are enforced server-side.
 *
 * Returns true when the backend confirms the address is valid. On network
 * or server errors, returns false so the lead form blocks submission — the
 * user can always retry.
 */
export async function validateLocation(address: string, zipCode: string): Promise<boolean> {
  const params = new URLSearchParams({ address, zip_code: zipCode });
  try {
    const res = await fetch(`${API_BASE}/api/maps/validate-address?${params.toString()}`);
    if (!res.ok) {
      console.warn("[validateLocation] backend returned non-OK", res.status);
      return false;
    }
    const data = (await res.json()) as { valid?: boolean };
    return Boolean(data?.valid);
  } catch (err) {
    console.warn("[validateLocation] request failed", err);
    return false;
  }
}

/**
 * Ask the backend for a pre-signed Google Maps Embed API URL for an iframe.
 * The API key is kept server-side (same project as the roof analyzer).
 */
export async function getMapEmbedUrl(
  lat: number,
  lng: number,
  opts: { zoom?: number; maptype?: "roadmap" | "satellite" | "hybrid" | "terrain" } = {},
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  if (opts.zoom != null) params.set("zoom", String(opts.zoom));
  if (opts.maptype) params.set("maptype", opts.maptype);
  try {
    const res = await fetch(`${API_BASE}/api/maps/embed-url?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data?.url ?? null;
  } catch {
    return null;
  }
}

export async function createLead(data: {
  name: string;
  address: string;
  zip_code: string;
  product_interest?: string;
  annual_electricity_kwh?: number;
}) {
  const res = await fetch(`${API_BASE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create lead: ${res.status}`);
  const lead = await res.json();
  if (lead && typeof lead.id === "string") {
    rememberMyLeadId(lead.id);
  }
  return lead;
}

export async function getLead(id: string) {
  const res = await fetch(`${API_BASE}/api/lead/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch lead: ${res.status}`);
  return res.json();
}

export async function getBriefing(id: string) {
  const res = await fetch(`${API_BASE}/api/lead/${id}/briefing`);
  if (res.status === 202) return null; // still processing
  if (!res.ok) throw new Error(`Failed to fetch briefing: ${res.status}`);
  return res.json();
}

export async function getLeads() {
  const myIds = readMyLeadIds();
  // If the user hasn't generated any leads in this browser yet, don't even
  // bother hitting the backend — they should see an empty list rather than
  // other people's leads.
  if (myIds.length === 0) return [];

  const res = await fetch(`${API_BASE}/api/leads`);
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  const all = await res.json();
  if (!Array.isArray(all)) return [];
  const mine = new Set(myIds);
  return all.filter((lead: { id?: string }) => lead?.id && mine.has(lead.id));
}

export async function recomputeOffers(leadId: string, annual_electricity_kwh: number) {
  const res = await fetch(`${API_BASE}/api/lead/${leadId}/recompute-offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annual_electricity_kwh }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to recompute offers: ${res.status} ${detail}`);
  }
  return res.json();
}
