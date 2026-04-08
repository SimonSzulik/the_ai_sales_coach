"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HOUSEHOLD_DEFAULT_KWH } from "@/lib/offerCalcConstants";
import { createLead, validateLocation } from "@/lib/api";

export default function LeadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLocationError(false);

    const fd = new FormData(e.currentTarget);
    const usageRaw = (fd.get("annual_electricity_kwh") as string)?.trim();
    let annual_electricity_kwh: number | undefined;
    if (usageRaw) {
      const n = Number(usageRaw);
      if (!Number.isFinite(n) || n < 1500 || n > 12000) {
        setError("Annual electricity usage must be between 1,500 and 12,000 kWh.");
        setLoading(false);
        return;
      }
      annual_electricity_kwh = n;
    }

    const payload = {
      name: fd.get("name") as string,
      address: fd.get("address") as string,
      zip_code: fd.get("zip_code") as string,
      product_interest: (fd.get("product_interest") as string) || undefined,
      ...(annual_electricity_kwh != null ? { annual_electricity_kwh } : {}),
    };

    // Sanity-check: make sure the address resolves to a real location
    const locationValid = await validateLocation(payload.address, payload.zip_code);
    if (!locationValid) {
      setLocationError(true);
      setLoading(false);
      return;
    }

    try {
      const lead = await createLead(payload);
      router.push(`/lead/${lead.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">New Lead</CardTitle>
        <CardDescription>
          Enter the customer&apos;s details to generate a personalised sales briefing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Customer Name</Label>
            <Input id="name" name="name" placeholder="Max Mustermann" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="Musterstraße 42"
              required
              onChange={() => setLocationError(false)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="zip_code">Postal Code</Label>
            <Input
              id="zip_code"
              name="zip_code"
              placeholder="68159"
              required
              minLength={4}
              maxLength={10}
              onChange={() => setLocationError(false)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product_interest">Product Interest (optional)</Label>
            <Input id="product_interest" name="product_interest" placeholder="Solar, Battery, Heat Pump, Wallbox" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="annual_electricity_kwh">Annual electricity usage (optional)</Label>
            <Input
              id="annual_electricity_kwh"
              name="annual_electricity_kwh"
              type="number"
              min={1500}
              max={12000}
              step={250}
              placeholder={`${HOUSEHOLD_DEFAULT_KWH.toLocaleString("de-DE")} (default)`}
            />
            <p className="text-xs text-muted-foreground">
              kWh per year (1,500–12,000). Leave empty to use the default {HOUSEHOLD_DEFAULT_KWH.toLocaleString("de-DE")}{" "}
              kWh model for offer economics.
            </p>
          </div>

          {locationError && (
            <p className="text-sm text-destructive">
              We couldn&apos;t find that address. Please double-check the street and postal code and try again.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Generating briefing..." : "Generate Briefing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
