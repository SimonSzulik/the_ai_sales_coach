"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Evidence = {
  source_url: string;
  source_title?: string;
  type?: string;
  snippet?: string;
};

type Profile = {
  platform: string;
  url: string;
  confidence?: string;
};

export type OsintData = {
  ev_status: "yes" | "no" | "NA";
  certainty_pct: number;
  summary: string;
  proof_image_url: string | null;
  evidence: Evidence[];
  discovered_profiles: Profile[];
  notes?: string;
};

interface Props {
  osint: { confidence: string; data: OsintData };
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  yes: "default",
  no: "destructive",
  NA: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  yes: "EV owner: YES",
  no: "EV owner: NO",
  NA: "EV ownership: unknown",
};

export default function OsintCard({ osint }: Props) {
  const data = osint?.data;
  if (!data) return null;

  const status = (data.ev_status || "NA") as "yes" | "no" | "NA";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          OSINT — Electric Vehicle
          <Badge variant={STATUS_BADGE[status] ?? "outline"}>{STATUS_LABEL[status]}</Badge>
          <Badge variant="secondary">{Math.round(data.certainty_pct ?? 0)}% certainty</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data.summary && <p className="text-muted-foreground">{data.summary}</p>}

        {data.proof_image_url && (
          <div>
            <a
              href={data.proof_image_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline text-blue-600"
            >
              Open proof image
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.proof_image_url}
              alt="OSINT proof"
              className="mt-2 max-h-48 rounded border"
            />
          </div>
        )}

        {data.evidence?.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
              Evidence
            </div>
            <ul className="space-y-1">
              {data.evidence.map((e, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={e.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-600"
                  >
                    {e.source_title || e.source_url}
                  </a>
                  {e.type && <span className="ml-1 text-muted-foreground">[{e.type}]</span>}
                  {e.snippet && <span className="block text-muted-foreground">{e.snippet}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.discovered_profiles?.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
              Discovered profiles
            </div>
            <ul className="space-y-1">
              {data.discovered_profiles.map((p, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-600"
                  >
                    {p.platform}
                  </a>
                  {p.confidence && (
                    <span className="ml-1 text-muted-foreground">({p.confidence})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.notes && (
          <p className="text-xs text-muted-foreground italic">Note: {data.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
