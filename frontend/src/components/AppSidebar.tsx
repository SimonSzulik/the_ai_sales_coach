"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useDashboard, type Section } from "@/components/DashboardContext";
import { Badge } from "@/components/ui/badge";

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
    label: "Pitch Assistant",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export default function AppSidebar() {
  const params = useParams<{ id: string }>();
  const { activeSection, setActiveSection, leads } = useDashboard();
  const [leadsOpen, setLeadsOpen] = useState(true);

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