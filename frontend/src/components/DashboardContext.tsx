"use client";

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

export type Section =
  | "overview"
  | "preresearch"
  | "checklist"
  | "offers"
  | "objections"
  | "market"
  | "assistant";

export interface LeadSummary {
  id: string;
  name: string;
  address: string;
  zip_code: string;
  product_interest?: string | null;
  status: string;
  created_at: string;
}

export interface DashboardState {
  activeSection: Section;
  setActiveSection: Dispatch<SetStateAction<Section>>;
  briefing: Record<string, unknown> | null;
  setBriefing: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  leads: LeadSummary[];
  setLeads: Dispatch<SetStateAction<LeadSummary[]>>;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<Section>("offers");
  const [briefing, setBriefing] = useState<Record<string, unknown> | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);

  return (
    <DashboardContext.Provider
      value={{ activeSection, setActiveSection, briefing, setBriefing, leads, setLeads }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
