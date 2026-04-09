"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type SanityCheck = {
  name: string;
  status: "pass" | "warn" | "fail" | "info";
  message: string;
  detail?: string | null;
};

interface Props {
  checks: SanityCheck[];
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pass: "default",
  warn: "secondary",
  fail: "destructive",
  info: "outline",
};

export default function SanityChecks({ checks }: Props) {
  if (!checks || checks.length === 0) return null;

  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          Sanity Checks
          {Object.entries(counts).map(([status, n]) => (
            <Badge key={status} variant={STATUS_BADGE[status] ?? "outline"} className="text-xs">
              {n} {status}
            </Badge>
          ))}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {checks.map((c, i) => (
          <div key={i} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE[c.status] ?? "outline"} className="text-xs">
                {c.status}
              </Badge>
              <span className="font-medium">{c.name}</span>
            </div>
            <span className="text-muted-foreground text-xs">{c.message}</span>
            {c.detail && (
              <span className="text-muted-foreground text-xs italic">{c.detail}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
