"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TrustEntry {
  enricher: string;
  source: string;
  confidence: string;
  timestamp: string;
  fallback_used: boolean;
}

interface Props {
  entries: TrustEntry[];
}

const confidenceValue: Record<string, number> = {
  high: 100,
  medium: 60,
  low: 30,
  none: 5,
};

const confidenceBadge: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
  none: "destructive",
};

export default function DataTrust({ entries }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Data Trust</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((e) => (
          <div key={e.enricher} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium truncate">{e.enricher}</span>
                <Badge variant={confidenceBadge[e.confidence] ?? "outline"} className="text-xs">
                  {e.confidence}
                </Badge>
                {e.fallback_used && (
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                    fallback
                  </Badge>
                )}
              </div>
              <Progress value={confidenceValue[e.confidence] ?? 0} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-0.5">
                {e.source} &middot; {new Date(e.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
