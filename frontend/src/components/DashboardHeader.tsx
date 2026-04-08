"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Props {
  name: string;
  address: string;
  zipCode: string;
  city?: string;
  productInterest?: string;
  score: number;
  drivers: string[];
  confidenceDisclaimer?: string;
}

function confidencePercent(score: number) {
  return Math.min(100, Math.max(0, Math.round(score * 0.9 + 10)));
}

export default function DashboardHeader({
  name,
  address,
  zipCode,
  city,
  productInterest,
  score,
}: Props) {
  const conf = confidencePercent(score);

  return (
    <div className="mb-4">
      {/* Back link + actions row */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to leads
        </Link>
        <button className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Add note
        </button>
      </div>

      {/* Main header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-14 w-14 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center shrink-0">
            {name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              {city && (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {city}, Germany
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {productInterest && (
                <Badge variant="default" className="text-xs bg-blue-600">
                  {productInterest} lead
                </Badge>
              )}
              <Badge
                variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}
                className={`text-xs ${score >= 70 ? "bg-yellow-500 text-white border-0" : ""}`}
              >
                {score >= 70 ? "High opportunity" : score >= 40 ? "Medium opportunity" : "Low opportunity"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Score boxes */}
        <div className="flex gap-3">
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[160px]">
            <div className="text-xs text-muted-foreground mb-1">Opportunity score</div>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-bold tabular-nums">{Math.round(score)}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden min-w-[60px]">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[130px]">
            <div className="text-xs text-muted-foreground mb-1">Confidence</div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold tabular-nums">{conf}%</span>
              <div className="flex-1 h-2 bg-green-100 rounded-full overflow-hidden min-w-[40px]">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${conf}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
