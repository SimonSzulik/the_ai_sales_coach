"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  score: number;
  drivers: string[];
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

export default function OpportunityScore({ score, drivers }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Opportunity Score</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold tabular-nums ${scoreColor(score)}`}>
            {Math.round(score)}
          </span>
          <span className="text-muted-foreground text-sm mb-1">/ 100</span>
        </div>
        <Progress value={score} className="h-2" />
        {drivers.length > 0 && (
          <ul className="text-sm space-y-1">
            {drivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
