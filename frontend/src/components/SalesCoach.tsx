"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  coach: {
    talk_track: string | string[];
    objections: { objection: string; rebuttal: string }[];
    qualifying_questions: string[];
    urgency_statement: string;
    confidence_disclaimer: string;
  };
}

export default function SalesCoach({ coach }: Props) {
  const [expandedObj, setExpandedObj] = useState<number | null>(null);

  const pitchPoints = Array.isArray(coach.talk_track)
    ? coach.talk_track
    : coach.talk_track.split("\n").filter((s) => s.trim());

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Sales Guideline</h2>
        <Badge variant="secondary" className="text-xs">AI-Generated</Badge>
      </div>

      {/* Quick Pitch */}
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <h4 className="text-sm font-semibold">Quick Pitch</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">~90 seconds</span>
          </div>
          <ul className="space-y-2">
            {pitchPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="text-blue-500 mt-1 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-muted-foreground leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Two-column: Conversation Tips + Why Act Now */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Conversation Tips */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-semibold">Conversation Tips</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Ask these to uncover needs and qualify the lead.
            </p>
            <ol className="space-y-1.5">
              {coach.qualifying_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{q}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Why Act Now */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-semibold">Why Act Now</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {coach.urgency_statement}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Objections */}
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h4 className="text-sm font-semibold">Customer Objections</h4>
            <Badge variant="outline" className="text-[10px] ml-auto">{coach.objections.length} prepared</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Common reasons the customer may hesitate, with your prepared rebuttals.
          </p>
          <div className="space-y-2">
            {coach.objections.map((o, i) => (
              <button
                key={i}
                onClick={() => setExpandedObj(expandedObj === i ? null : i)}
                className="w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-medium">&ldquo;{o.objection}&rdquo;</span>
                  <svg
                    className={`w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${expandedObj === i ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedObj === i && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-green-700 mb-1">Your rebuttal:</p>
                    <p className="text-sm text-muted-foreground">{o.rebuttal}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confidence disclaimer */}
      {coach.confidence_disclaimer && (
        <p className="text-xs text-muted-foreground italic px-1">{coach.confidence_disclaimer}</p>
      )}
    </div>
  );
}
