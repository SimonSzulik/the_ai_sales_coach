const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Validates that an address + postal code resolves to a real location
 * using OpenStreetMap's Nominatim geocoding API (free, no key required).
 * Returns true if found, false otherwise.
 */
export async function validateLocation(address: string, zipCode: string): Promise<boolean> {
  const query = encodeURIComponent(`${address}, ${zipCode}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "AICoachApp/1.0" },
    });
    if (!res.ok) return true; // fail open if the geocoding service is down
    const results = await res.json();
    return Array.isArray(results) && results.length > 0;
  } catch {
    return true; // fail open on network error
  }
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
