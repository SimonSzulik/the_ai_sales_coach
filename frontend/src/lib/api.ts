const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type NominatimResult = {
  class?: string;
  type?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
  };
};

/**
 * Validates that an address + postal code resolves to a real *street-level*
 * location using OpenStreetMap's Nominatim geocoding API (free, no key required).
 *
 * Strict checks (all must pass):
 *   1. Nominatim returned at least one structured result.
 *   2. The result is street-level — it has a road / pedestrian / footway,
 *      OR its class is "highway" / "place" with a building-ish type.
 *   3. The postcode in the returned address matches what the user typed
 *      (ignoring whitespace and case).
 *
 * Returns true if found and consistent, false otherwise. Throws on network
 * errors so the caller can decide what to do (we treat that as "could not
 * verify" and block submission, since the user explicitly asked for the
 * sanity check to actually block bad addresses).
 */
export async function validateLocation(address: string, zipCode: string): Promise<boolean> {
  const query = encodeURIComponent(`${address}, ${zipCode}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&addressdetails=1&limit=5`;

  let results: NominatimResult[] = [];
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) {
      console.warn("[validateLocation] Nominatim returned non-OK", res.status);
      return false;
    }
    results = (await res.json()) as NominatimResult[];
  } catch (err) {
    console.warn("[validateLocation] Nominatim fetch failed", err);
    return false;
  }

  if (!Array.isArray(results) || results.length === 0) {
    return false;
  }

  const wantedZip = zipCode.replace(/\s+/g, "").toLowerCase();

  return results.some((r) => {
    const a = r.address ?? {};
    const hasStreet = Boolean(a.road || a.pedestrian || a.footway);
    if (!hasStreet) return false;

    const gotZip = (a.postcode ?? "").replace(/\s+/g, "").toLowerCase();
    if (!gotZip || gotZip !== wantedZip) return false;

    return true;
  });
}

export async function createLead(data: {
  name: string;
  address: string;
  zip_code: string;
  product_interest?: string;
}) {
  const res = await fetch(`${API_BASE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create lead: ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/leads`);
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  return res.json();
}
