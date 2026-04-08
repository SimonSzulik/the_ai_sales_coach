"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createLead } from "@/lib/api";

export default function LeadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      address: fd.get("address") as string,
      zip_code: fd.get("zip_code") as string,
      product_interest: (fd.get("product_interest") as string) || undefined,
    };

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
            <Input id="address" name="address" placeholder="Musterstraße 42" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="zip_code">Postal Code</Label>
            <Input id="zip_code" name="zip_code" placeholder="68159" required minLength={4} maxLength={10} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product_interest">Product Interest (optional)</Label>
            <Input id="product_interest" name="product_interest" placeholder="Solar, Battery, Heat Pump, Wallbox" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Generating briefing..." : "Generate Briefing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
