"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getBriefing } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import OverviewTab from "@/components/OverviewTab";
import OfferCards from "@/components/OfferCards";
import OfferComparison from "@/components/OfferComparison";
import FinancingTable from "@/components/FinancingTable";
import MarketContext from "@/components/MarketContext";
import DataTrust from "@/components/DataTrust";
import SalesCoach from "@/components/SalesCoach";

type Briefing = {
  lead: { name: string; address: string; zip_code: string; product_interest?: string };
  enrichment: {
    geo: { confidence: string; data: Record<string, unknown> };
    solar: { confidence: string; data: Record<string, unknown> };
    energy: { confidence: string; data: Record<string, unknown> };
    subsidies: { confidence: string; data: Record<string, unknown> };
    market_context: { confidence: string; data: Record<string, unknown> };
    opportunity_score: number;
    opportunity_drivers: string[];
  };
  offers: {
    offer: {
      tier: string;
      label: string;
      rationale: string;
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
        <div className="w-full max-w-5xl grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-xl col-span-full" />
          <Skeleton className="h-32 rounded-xl col-span-full" />
        </div>
      </main>
    );
  }

  const e = briefing.enrichment;

  return (
    <main className="flex flex-1 flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">
      <DashboardHeader
        name={briefing.lead.name}
        address={briefing.lead.address}
        zipCode={briefing.lead.zip_code}
        city={e.geo.data.city as string | undefined}
        productInterest={briefing.lead.product_interest ?? undefined}
        score={e.opportunity_score}
        drivers={e.opportunity_drivers}
        confidenceDisclaimer={briefing.coach.confidence_disclaimer}
      />

      <Tabs defaultValue="offers">
        <TabsList variant="line" className="w-full justify-start border-b pb-0 mb-6">
          <TabsTrigger value="overview" className="text-sm px-4 py-2">Overview</TabsTrigger>
          <TabsTrigger value="offers" className="text-sm px-4 py-2">Offers</TabsTrigger>
          <TabsTrigger value="market" className="text-sm px-4 py-2">Market Research</TabsTrigger>
          <TabsTrigger value="coach" className="text-sm px-4 py-2">Sales Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            lead={briefing.lead}
            geo={e.geo}
            solar={e.solar}
            energy={e.energy}
            subsidies={e.subsidies}
            marketContext={e.market_context}
            score={e.opportunity_score}
            drivers={e.opportunity_drivers}
          />
        </TabsContent>

        <TabsContent value="offers">
          <div className="space-y-6 mt-4">
            <OfferCards offers={briefing.offers} />
            <OfferComparison offers={briefing.offers} />
            <FinancingTable offers={briefing.offers} />
          </div>
        </TabsContent>

        <TabsContent value="market">
          <div className="space-y-4 mt-4">
            <MarketContext data={e.market_context.data as never} />
            <DataTrust entries={briefing.data_trust} />
          </div>
        </TabsContent>

        <TabsContent value="coach">
          <div className="mt-4">
            <SalesCoach coach={briefing.coach} />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
