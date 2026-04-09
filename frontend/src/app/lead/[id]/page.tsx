"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefing, getLeads } from "@/lib/api";
import { HOUSEHOLD_DEFAULT_KWH } from "@/lib/offerCalcConstants";
import { useDashboard } from "@/components/DashboardContext";
import DashboardHeader from "@/components/DashboardHeader";
import OverviewTab from "@/components/OverviewTab";
import OfferCards from "@/components/OfferCards";
import CompareNumbers from "@/components/CompareNumbers";
import FinancingInfo from "@/components/FinancingInfo";
import FinancingTable from "@/components/FinancingTable";
import WhyRecommended from "@/components/WhyRecommended";
import ReadyCTA from "@/components/ReadyCTA";
import MarketContext from "@/components/MarketContext";

import SalesCoach from "@/components/SalesCoach";
import RoofAnalysisTab from "@/components/RoofAnalysisTab";
import OsintCard, { OsintData } from "@/components/OsintCard";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";

type Briefing = {
  lead: {
    name: string;
    address: string;
    zip_code: string;
    product_interest?: string;
    annual_electricity_kwh?: number | null;
  };
  enrichment: {
    geo: { confidence: string; data: Record<string, unknown> };
    solar: { confidence: string; data: Record<string, unknown> };
    energy: { confidence: string; data: Record<string, unknown> };
    subsidies: { confidence: string; data: Record<string, unknown> };
    market_context: { confidence: string; data: Record<string, unknown> };
    roof_analysis?: { confidence: string; data: Record<string, unknown> };
    osint?: { confidence: string; data: OsintData };
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
      self_consumption_pct: number;
      annual_production_kwh: number;
      roof_utilization_pct: number;
      system_kwp: number;
      battery_kwh: number;
      retail_price_eur_kwh: number;
      feed_in_tariff_eur: number;
      has_heat_pump: boolean;
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
    talk_track: string | string[];
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
  const { activeSection, setBriefing: setCtxBriefing, setLeads, setActiveSection } = useDashboard();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFinancing, setShowFinancing] = useState(false);
  const financingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveSection("overview");
  }, [id, setActiveSection]);

  const poll = useCallback(async () => {
    try {
      const data = await getBriefing(id);
      if (data) {
        setBriefing(data);
        setCtxBriefing(data);
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
  }, [id, setCtxBriefing]);

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

  useEffect(() => {
    getLeads()
      .then((data) => setLeads(data))
      .catch(() => {});
  }, [setLeads]);

  const handleShowFinancing = () => {
    setShowFinancing(true);
    setTimeout(() => financingRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

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
  const maxSubsidy = briefing.offers[0]?.financing[0]?.subsidy_deducted_eur ?? 0;
  const leadAnnualKwh = briefing.lead.annual_electricity_kwh ?? HOUSEHOLD_DEFAULT_KWH;

  return (
    <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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

      {/* Overview */}
      {activeSection === "overview" && (
        <OverviewTab
          lead={briefing.lead}
          annualHouseholdKwh={leadAnnualKwh}
          geo={e.geo}
          solar={e.solar}
          energy={e.energy}
          subsidies={e.subsidies}
          marketContext={e.market_context}
          roofAnalysis={e.roof_analysis}
          drivers={e.opportunity_drivers}
        />
      )}

      {/* Roof Analysis */}
      {activeSection === "roof" && (
        <RoofAnalysisTab
          leadId={id}
          roofData={e.roof_analysis?.data as Record<string, unknown> | undefined}
        />
      )}

      {/* Offers — main section */}
      {activeSection === "offers" && (
        <TooltipProvider>
          <div className="space-y-8 mt-4">
            <OfferCards
              leadId={id}
              leadAnnualKwh={briefing.lead.annual_electricity_kwh ?? null}
              offers={briefing.offers}
              name={briefing.lead.name}
              onShowFinancing={handleShowFinancing}
              enrichment={briefing.enrichment}
              onBriefingSynced={(data) => {
                setBriefing(data as Briefing);
                setCtxBriefing(data as Briefing);
              }}
            />

            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <CompareNumbers
                  offers={briefing.offers}
                  enrichment={briefing.enrichment}
                  annualHouseholdKwh={leadAnnualKwh}
                />
              </div>
              <div className="lg:col-span-2">
                <FinancingInfo
                  maxSubsidy={maxSubsidy}
                  onExplore={handleShowFinancing}
                />
              </div>
            </div>

            {showFinancing && (
              <div ref={financingRef}>
                <FinancingTable offers={briefing.offers} />
              </div>
            )}

            <Separator />

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WhyRecommended offers={briefing.offers} />
              </div>
              <div>
                <ReadyCTA name={briefing.lead.name} />
              </div>
            </div>

            {e.osint && (
              <div className="grid gap-5 lg:grid-cols-2">
                <OsintCard osint={e.osint} />
              </div>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* Market */}
      {activeSection === "market" && (
        <MarketContext data={e.market_context.data as never} />
      )}

      {/* Pitch Assistant */}
      {activeSection === "assistant" && (
        <div className="mt-4">
          <SalesCoach coach={briefing.coach} />
        </div>
      )}
    </main>
  );
}