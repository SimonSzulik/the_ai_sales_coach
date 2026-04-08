"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
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
    <div className="mb-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar placeholder */}
          <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white text-xl font-bold shrink-0">
            {name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              {city && (
                <span className="text-sm text-muted-foreground">
                  {city}, Germany
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {productInterest && (
                <Badge variant="default" className="text-xs">
                  {productInterest} lead
                </Badge>
              )}
              <Badge
                variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}
                className="text-xs"
              >
                {score >= 70 ? "High opportunity" : score >= 40 ? "Medium opportunity" : "Low opportunity"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {address}, {zipCode}
              </span>
            </div>
          </div>
        </div>

        {/* Score boxes */}
        <div className="flex gap-3">
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[150px]">
            <div className="text-xs text-muted-foreground mb-1">Opportunity score</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>
                {Math.round(score)}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Progress value={score} className="h-1.5 mt-1.5" />
          </div>
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[130px]">
            <div className="text-xs text-muted-foreground mb-1">Confidence</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-green-600">
                {conf}%
              </span>
            </div>
            <Progress value={conf} className="h-1.5 mt-1.5" />
          </div>
          <Link
            href="/"
            className="hidden sm:inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted self-center"
          >
            New Lead
          </Link>
        </div>
      </div>
    </div>
  );
}
