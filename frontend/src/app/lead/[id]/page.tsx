"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefing } from "@/lib/api";
import LeadSnapshot from "@/components/LeadSnapshot";
import OpportunityScore from "@/components/OpportunityScore";
import OfferComparison from "@/components/OfferComparison";
import FinancingTable from "@/components/FinancingTable";
import SalesCoach from "@/components/SalesCoach";
import DataTrust from "@/components/DataTrust";

type Briefing = {
  lead: { name: string; address: string; zip_code: string; product_interest?: string };
  enrichment: {
    geo: { confidence: string; data: Record<string, unknown> };
    solar: { confidence: string; data: Record<string, unknown> };
    energy: { confidence: string; data: Record<string, unknown> };
    subsidies: { confidence: string; data: Record<string, unknown> };
    opportunity_score: number;
    opportunity_drivers: string[];
  };
  offers: {
    offer: {
      tier: string;
      label: string;
      components: { name: string; description: string; unit_cost_eur: number }[];
      capex_eur: number;
      annual_savings_eur: number;
      payback_years: number;
      co2_saved_kg: number;
    };
    financing: {
      type: string;
      down_payment_eur: number;
      loan_principal_eur: number;
      interest_rate_pct: number;
      term_years: number;
      monthly_payment_eur: number;
      total_cost_eur: number;
      subsidy_deducted_eur: number;
    }[];
  }[];
  coach: {
    talk_track: string;
    objections: { objection: string; rebuttal: string }[];
    qualifying_questions: string[];
    urgency_statement: string;
    confidence_disclaimer: string;
  };
  data_trust: {
    enricher: string;
    source: string;
    confidence: string;
    timestamp: string;
    fallback_used: boolean;
  }[];
};

export default function BriefingPage() {
  const { id } = useParams<{ id: string }>();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const poll = useCallback(async () => {
    try {
      const data = await getBriefing(id);
      if (data) {
        setBriefing(data);
        setLoading(false);
        return true;
      }
      return false;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("202")) return false;
      setError(err instanceof Error ? err.message : "Failed to load briefing");
      setLoading(false);
      return true;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loop() {
      while (!cancelled) {
        const done = await poll();
        if (done || cancelled) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    loop();
    return () => { cancelled = true; };
  }, [poll]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6 gap-4">
        <p className="text-destructive">{error}</p>
        <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
          Back to form
        </Link>
      </main>
    );
  }

  if (loading || !briefing) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6 gap-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold">Generating your briefing...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Researching location, solar potential, energy prices, and subsidies
          </p>
        </div>
        <div className="w-full max-w-4xl grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg col-span-full" />
          <Skeleton className="h-32 rounded-lg col-span-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Briefing</h1>
          <p className="text-sm text-muted-foreground">
            Prepared for {briefing.lead.name} &middot; {briefing.lead.zip_code}
          </p>
        </div>
        <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted">
          New Lead
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LeadSnapshot lead={briefing.lead} geo={briefing.enrichment.geo as never} />
        <OpportunityScore
          score={briefing.enrichment.opportunity_score}
          drivers={briefing.enrichment.opportunity_drivers}
        />
        <OfferComparison offers={briefing.offers} />
        <FinancingTable offers={briefing.offers} />
        <SalesCoach coach={briefing.coach} />
        <div className="md:col-span-2">
          <DataTrust entries={briefing.data_trust} />
        </div>
      </div>
    </main>
  );
}
