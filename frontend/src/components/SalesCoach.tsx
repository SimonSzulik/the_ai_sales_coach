"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  coach: {
    talk_track: string;
    objections: { objection: string; rebuttal: string }[];
    qualifying_questions: string[];
    urgency_statement: string;
    confidence_disclaimer: string;
  };
}

export default function SalesCoach({ coach }: Props) {
  const [expandedObj, setExpandedObj] = useState<number | null>(null);

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Sales Coach</CardTitle>
          <Badge variant="secondary">AI-Generated</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {/* Talk track */}
        <div>
          <h4 className="text-sm font-semibold mb-1">90-Second Talk Track</h4>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {coach.talk_track}
          </p>
        </div>

        <Separator />

        {/* Urgency */}
        <div>
          <h4 className="text-sm font-semibold mb-1">Why Now</h4>
          <p className="text-sm text-muted-foreground">{coach.urgency_statement}</p>
        </div>

        <Separator />

        {/* Objections */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Likely Objections</h4>
          <div className="space-y-2">
            {coach.objections.map((o, i) => (
              <button
                key={i}
                onClick={() => setExpandedObj(expandedObj === i ? null : i)}
                className="w-full text-left rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium">&ldquo;{o.objection}&rdquo;</span>
                  <span className="text-xs text-muted-foreground ml-2">{expandedObj === i ? "▲" : "▼"}</span>
                </div>
                {expandedObj === i && (
                  <p className="mt-2 text-sm text-muted-foreground">{o.rebuttal}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Qualifying questions */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Qualifying Questions</h4>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            {coach.qualifying_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>

        {coach.confidence_disclaimer && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground italic">{coach.confidence_disclaimer}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
