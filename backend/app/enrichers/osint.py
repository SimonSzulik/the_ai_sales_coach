"""Open-source intelligence (OSINT) enricher.

Goal (scoped down per product feedback): determine whether the customer
already owns an electric vehicle. The pipeline performs a real web search
through the active LLM provider against publicly available sources
(LinkedIn, Facebook, Instagram, Xing, German Handelsregister, local news,
Google Images) and returns a single structured EV finding plus the
breadcrumbs that led to the verdict.

The verdict is one of:

* ``"yes"``  – proof picture exists (EV badge / charging cable / wallbox)
* ``"no"``   – proof picture exists showing a non-EV ICE vehicle
* ``"_"``    – no hints found, or evidence is too weak / contradictory

Each verdict carries an ``evidence`` list with ``source_url`` and
``proof_image_url`` fields when available so the sales rep can audit the
finding before relying on it.
"""

from __future__ import annotations

import logging
from typing import Any

from app.llm import LLMError, complete_json, llm_configured
from app.models import Confidence, EnrichmentResult

logger = logging.getLogger(__name__)

UNKNOWN_EV = "_"


OSINT_SYSTEM_PROMPT = """\
You are a German residential-energy sales OSINT assistant. Given a customer's
full name and address, use web search to gather publicly visible information
that helps a solar/EV sales rep prepare for the visit.

You MUST stay within publicly available, legally browsable sources only:
LinkedIn / Xing public profiles, Facebook / Instagram public posts,
Twitter/X public posts, the German Handelsregister
(https://www.handelsregister.de), Northdata, local newspaper coverage,
company websites, public Google Image results, and similar.

DO NOT scrape paywalled content, do NOT invent profile URLs, do NOT guess
photos you cannot actually see during the search. If you cannot verify
something, use JSON null for optional fields; for ev_status when unknown use "_".

YOUR ONLY RESEARCH GOAL: does this customer already own an electric vehicle?

How to decide:

- "yes"  → you found a public picture or post that clearly shows EITHER
           (a) the customer's EV (Tesla, ID.3/4, e-tron, Polestar, EQ*,
           BMW i*, Hyundai Ioniq EV, Renault Zoe, etc.) or (b) a wallbox /
           charging cable installed at their home / workplace / driveway.
           You MUST cite the proof_image_url AND the source_url.
- "no"   → you found a clear public picture / post showing the customer's
           current car AND it is unambiguously a combustion / hybrid
           vehicle (no charging port, classic ICE model). Cite proof_image_url
           AND source_url.
- "_"    → no clear evidence either way (no hints, contradictory hints,
           or images you cannot actually verify).

The "certainty_pct" field must be 100 only when a real proof image was
viewed. Otherwise use 0 (for "_") or 50-90 if you found textual but not
visual evidence.

Respond ONLY with valid JSON matching this exact schema:

{
  "ev_status": "yes" | "no" | "_",
  "certainty_pct": number,                // 0-100
  "summary": "string — 1-2 sentences explaining the verdict",
  "proof_image_url": "string | null",     // direct image URL if available
  "evidence": [
    {
      "source_url": "string",
      "source_title": "string",
      "type": "linkedin" | "instagram" | "facebook" | "xing" | "handelsregister" | "news" | "image" | "other",
      "snippet": "string — what you actually saw, max 1 sentence"
    }
  ],
  "discovered_profiles": [
    {
      "platform": "string",
      "url": "string",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "string — anything the sales rep should know, max 2 sentences"
}
"""


def _coerce(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize the LLM payload so downstream code can rely on it."""
    raw = str(data.get("ev_status", "") or "").strip().lower()
    if raw == "yes":
        status = "yes"
    elif raw == "no":
        status = "no"
    elif raw in ("_", "na", "nav", "n/a", "unknown", ""):
        status = UNKNOWN_EV
    else:
        status = UNKNOWN_EV

    try:
        certainty = float(data.get("certainty_pct", 0) or 0)
    except (TypeError, ValueError):
        certainty = 0.0
    certainty = max(0.0, min(100.0, certainty))

    evidence = data.get("evidence") or []
    if not isinstance(evidence, list):
        evidence = []
    evidence = [e for e in evidence if isinstance(e, dict) and e.get("source_url")]

    profiles = data.get("discovered_profiles") or []
    if not isinstance(profiles, list):
        profiles = []
    profiles = [p for p in profiles if isinstance(p, dict) and p.get("url")]

    proof = data.get("proof_image_url")
    if not isinstance(proof, str):
        proof = None
    else:
        p = proof.strip()
        if not p or p.lower() in ("null", "na", "nav", "n/a", "_"):
            proof = None
        else:
            proof = p

    return {
        "ev_status": status,
        "certainty_pct": certainty,
        "summary": (data.get("summary") or "").strip(),
        "proof_image_url": proof,
        "evidence": evidence,
        "discovered_profiles": profiles,
        "notes": (data.get("notes") or "").strip(),
    }


async def enrich_osint(name: str, address: str, zip_code: str) -> EnrichmentResult:
    """Run the EV-focused OSINT pipeline for a customer."""
    if not llm_configured():
        return EnrichmentResult(
            source="osint_ev",
            confidence=Confidence.NONE,
            fallback_used=True,
            data={
                "ev_status": UNKNOWN_EV,
                "certainty_pct": 0,
                "summary": "OSINT skipped: no LLM provider configured.",
                "proof_image_url": None,
                "evidence": [],
                "discovered_profiles": [],
                "notes": "Set ANTHROPIC_API_KEY or OPENAI_API_KEY (and LLM_PROVIDER) to enable.",
            },
        )

    user_msg = (
        f"Customer name: {name}\n"
        f"Address: {address}, {zip_code}, Germany\n\n"
        "Step 1 — Identify likely public profiles for this person on LinkedIn, "
        "Xing, Facebook, Instagram. Cross-check the city / zip to disambiguate.\n"
        "Step 2 — Check the German Handelsregister and Northdata for any "
        "company affiliation that could matter.\n"
        "Step 3 — Search for public images or posts that show the customer's "
        "current car or wallbox. Use Google Images, Instagram public posts, "
        "and the discovered profiles.\n"
        "Step 4 — Decide ev_status strictly per the rules in the system prompt. "
        "Only return ev_status='yes' or 'no' if you actually viewed a proof image."
    )

    try:
        raw = await complete_json(
            system=OSINT_SYSTEM_PROMPT,
            user=user_msg,
            max_tokens=2500,
            temperature=0.2,
            web_search=True,
        )
    except (LLMError, Exception) as exc:
        logger.exception("OSINT enrichment failed")
        return EnrichmentResult(
            source="osint_ev",
            confidence=Confidence.NONE,
            fallback_used=True,
            error=str(exc),
            data={
                "ev_status": UNKNOWN_EV,
                "certainty_pct": 0,
                "summary": f"OSINT lookup failed: {exc}",
                "proof_image_url": None,
                "evidence": [],
                "discovered_profiles": [],
                "notes": "",
            },
        )

    payload = _coerce(raw)
    status = payload["ev_status"]
    certainty = payload["certainty_pct"]

    if status in {"yes", "no"} and payload["proof_image_url"]:
        confidence = Confidence.HIGH
    elif status in {"yes", "no"}:
        confidence = Confidence.MEDIUM
    elif payload["evidence"]:
        confidence = Confidence.LOW
    else:
        confidence = Confidence.NONE

    return EnrichmentResult(
        source="osint_ev",
        confidence=confidence,
        data=payload,
    )
