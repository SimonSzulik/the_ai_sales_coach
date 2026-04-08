"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useDashboard, type Section } from "@/components/DashboardContext";
import { Badge } from "@/components/ui/badge";

interface Source {
  title: string;
  url: string;
  type: string;
}

const sectionItems: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    id: "preresearch",
    label: "Pre-research",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: "checklist",
    label: "On-site checklist",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "roof",
    label: "Roof Analysis",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: "offers",
    label: "Offers",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: "objections",
    label: "Objections",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    id: "market",
    label: "Market",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "assistant",
    label: "AI Assistant",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

function sourceIcon(type: string) {
  if (type === "subsidy" || type === "program") {
    return (
      <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (type === "regulation") {
    return (
      <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    );
  }
  if (type === "utility") {
    return (
      <svg className="w-3.5 h-3.5 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

export default function AppSidebar() {
  const params = useParams<{ id: string }>();
  const { activeSection, setActiveSection, briefing, leads } = useDashboard();
  const [docsOpen, setDocsOpen] = useState(true);
  const [leadsOpen, setLeadsOpen] = useState(true);

  const mc = (briefing as Record<string, unknown>)?.enrichment as Record<string, unknown> | undefined;
  const marketData = (mc?.market_context as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const sources: Source[] = (marketData?.sources as Source[]) ?? [];
  const dataTrust = (briefing as Record<string, unknown>)?.data_trust as { enricher: string; source: string }[] | undefined;
  const municipalPrograms = (marketData?.municipal_programs as { name: string; provider: string }[]) ?? [];

  const allDocs: { title: string; url?: string; type: string }[] = [
    ...sources,
    ...(dataTrust ?? []).map((dt) => ({
      title: `${dt.enricher} (${dt.source})`,
      type: "data",
    })),
    ...municipalPrograms
      .filter((p) => !sources.some((s) => s.title.includes(p.name)))
      .map((p) => ({
        title: `${p.name} — ${p.provider}`,
        type: "program",
      })),
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-border shrink-0 sticky top-0 h-screen overflow-y-auto">
      {/* Logo bar */}
      <div className="flex items-center gap-2 px-4 h-14 border-b">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          K
        </div>
        <span className="font-semibold text-sm">AI Sales Coach</span>
      </div>

      {/* Back link */}
      <div className="px-4 py-2 border-b">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      {/* Section navigation */}
      <div className="px-2 py-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
          Sections
        </div>
        <nav className="space-y-0.5">
          {sectionItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className={isActive ? "text-blue-600" : ""}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Documents */}
      <div className="px-2 py-1 border-t">
        <button
          onClick={() => setDocsOpen(!docsOpen)}
          className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documents
            {allDocs.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{allDocs.length}</Badge>
            )}
          </span>
          <svg className={`w-3 h-3 transition-transform ${docsOpen ? "rotate-0" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {docsOpen && (
          <div className="space-y-0.5 px-1 pb-2 max-h-48 overflow-y-auto">
            {allDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">
                {briefing ? "No documents found" : "Loading..."}
              </p>
            ) : (
              allDocs.map((doc, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                  {sourceIcon(doc.type)}
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline leading-tight truncate"
                      title={doc.title}
                    >
                      {doc.title}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground leading-tight truncate" title={doc.title}>
                      {doc.title}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Leads */}
      <div className="px-2 py-1 border-t">
        <button
          onClick={() => setLeadsOpen(!leadsOpen)}
          className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Leads
            {leads.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{leads.length}</Badge>
            )}
          </span>
          <svg className={`w-3 h-3 transition-transform ${leadsOpen ? "rotate-0" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {leadsOpen && (
          <div className="space-y-0.5 px-1 pb-2 max-h-52 overflow-y-auto">
            {leads.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">No leads yet</p>
            ) : (
              leads.map((lead) => {
                const isCurrent = params?.id === lead.id;
                return (
                  <Link
                    key={lead.id}
                    href={`/lead/${lead.id}`}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                      isCurrent
                        ? "bg-blue-50 text-blue-700"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isCurrent ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {lead.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{lead.name}</div>
                      <div className="text-[10px] text-muted-foreground">{lead.zip_code}</div>
                    </div>
                    <Badge
                      variant={lead.status === "done" ? "default" : lead.status === "error" ? "destructive" : "secondary"}
                      className="text-[9px] px-1.5 py-0 h-4 shrink-0"
                    >
                      {lead.status === "done" ? "Ready" : lead.status}
                    </Badge>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Bottom user */}
      <div className="mt-auto flex items-center gap-2 px-4 py-3 border-t">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          SC
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">Sales Coach</div>
          <div className="text-[10px] text-muted-foreground">Online</div>
        </div>
      </div>
    </aside>
  );
}