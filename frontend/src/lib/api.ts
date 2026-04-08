const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
