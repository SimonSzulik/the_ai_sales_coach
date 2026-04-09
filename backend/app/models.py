"""Pydantic schemas and SQLAlchemy ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import JSON, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# ---------------------------------------------------------------------------
# SQLAlchemy ORM
# ---------------------------------------------------------------------------

class LeadRow(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(String(500))
    zip_code: Mapped[str] = mapped_column(String(10))
    product_interest: Mapped[str | None] = mapped_column(String(100), nullable=True)
    annual_electricity_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    enrichment_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    briefing_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

DEFAULT_ANNUAL_ELECTRICITY_KWH = 4_000.0
MIN_ANNUAL_ELECTRICITY_KWH = 1_500.0
MAX_ANNUAL_ELECTRICITY_KWH = 12_000.0


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=500)
    zip_code: str = Field(..., min_length=4, max_length=10)
    product_interest: str | None = Field(None, max_length=100)
    annual_electricity_kwh: float | None = Field(
        None,
        ge=MIN_ANNUAL_ELECTRICITY_KWH,
        le=MAX_ANNUAL_ELECTRICITY_KWH,
        description="Annual household electricity use (kWh/yr); defaults to 4000 when omitted.",
    )


class LeadResponse(BaseModel):
    id: str
    name: str
    address: str
    zip_code: str
    product_interest: str | None
    annual_electricity_kwh: float | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RecomputeOffersBody(BaseModel):
    annual_electricity_kwh: float = Field(
        ...,
        ge=MIN_ANNUAL_ELECTRICITY_KWH,
        le=MAX_ANNUAL_ELECTRICITY_KWH,
    )


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class EnrichmentResult(BaseModel):
    source: str
    confidence: Confidence = Confidence.NONE
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    fallback_used: bool = False
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class GeoData(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    display_name: str | None = None
    building_type: str | None = None


class SolarData(BaseModel):
    annual_kwh_per_kwp: float | None = None
    optimal_angle: float | None = None
    optimal_azimuth: float | None = None
    monthly_kwh: list[float] = Field(default_factory=list)


class EnergyPriceData(BaseModel):
    wholesale_price_eur_mwh: float | None = None
    retail_price_eur_kwh: float = 0.35
    price_trend: str = "stable"


class SubsidyData(BaseModel):
    programs: list[SubsidyProgram] = Field(default_factory=list)
    total_potential_eur: float = 0.0


class SubsidyProgram(BaseModel):
    name: str
    provider: str
    amount_eur: float
    type: str  # "grant" | "low_interest_loan"
    eligible: bool = True
    deadline: str | None = None
    notes: str | None = None


# Fix forward reference
SubsidyData.model_rebuild()


class EnrichmentBundle(BaseModel):
    geo: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="nominatim"))
    solar: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="pvgis"))
    energy: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="smard"))
    subsidies: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="kfw_bafa"))
    market_context: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="market_context_ai"))
    roof_analysis: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="roof_analyzer"))
    osint: EnrichmentResult = Field(default_factory=lambda: EnrichmentResult(source="osint_ev"))
    opportunity_score: float = 0.0
    opportunity_drivers: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Offer + Financing
# ---------------------------------------------------------------------------

class OfferTier(str, Enum):
    STARTER = "starter"
    RECOMMENDED = "recommended"
    PREMIUM = "premium"


class OfferComponent(BaseModel):
    name: str
    description: str
    quantity: int = 1
    unit_cost_eur: float = 0.0


class Offer(BaseModel):
    tier: OfferTier
    label: str
    rationale: str = ""
    components: list[OfferComponent] = Field(default_factory=list)
    capex_eur: float = 0.0
    annual_savings_eur: float = 0.0
    payback_years: float = 0.0
    co2_saved_kg: float = 0.0
    self_consumption_pct: float = 0.0
    annual_production_kwh: float = 0.0
    roof_utilization_pct: float = 0.0
    system_kwp: float = 0.0
    battery_kwh: float = 0.0
    retail_price_eur_kwh: float = 0.35
    feed_in_tariff_eur: float = 0.081
    has_heat_pump: bool = False


class FinancingScenario(BaseModel):
    type: str  # "cash" | "partial" | "full"
    down_payment_eur: float = 0.0
    loan_principal_eur: float = 0.0
    interest_rate_pct: float = 0.0
    term_years: int = 0
    monthly_payment_eur: float = 0.0
    total_cost_eur: float = 0.0
    subsidy_deducted_eur: float = 0.0


class OfferWithFinancing(BaseModel):
    offer: Offer
    financing: list[FinancingScenario] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Sales Coach
# ---------------------------------------------------------------------------

class SalesCoachOutput(BaseModel):
    talk_track: list[str] = Field(default_factory=list)
    objections: list[ObjectionRebuttal] = Field(default_factory=list)
    qualifying_questions: list[str] = Field(default_factory=list)
    urgency_statement: str = ""
    confidence_disclaimer: str = ""


class ObjectionRebuttal(BaseModel):
    objection: str
    rebuttal: str


SalesCoachOutput.model_rebuild()


# ---------------------------------------------------------------------------
# Data Trust
# ---------------------------------------------------------------------------

class DataTrustEntry(BaseModel):
    enricher: str
    source: str
    confidence: Confidence
    timestamp: datetime
    fallback_used: bool


# ---------------------------------------------------------------------------
# Full Briefing Response
# ---------------------------------------------------------------------------

class SanityCheck(BaseModel):
    name: str
    status: str  # "pass" | "warn" | "fail" | "info"
    message: str
    detail: str | None = None


class BriefingResponse(BaseModel):
    lead: LeadResponse
    enrichment: EnrichmentBundle
    offers: list[OfferWithFinancing] = Field(default_factory=list)
    coach: SalesCoachOutput = Field(default_factory=SalesCoachOutput)
    data_trust: list[DataTrustEntry] = Field(default_factory=list)
    sanity_checks: list[SanityCheck] = Field(default_factory=list)
