from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    BriefingResponse,
    LeadCreate,
    LeadResponse,
    LeadRow,
)
from app.pipeline import run_pipeline

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/lead", response_model=LeadResponse, status_code=201)
async def create_lead(
    payload: LeadCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    row = LeadRow(
        name=payload.name,
        address=payload.address,
        zip_code=payload.zip_code,
        product_interest=payload.product_interest,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    background.add_task(run_pipeline, row.id)

    return row


@router.get("/lead/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(LeadRow, lead_id)
    if not row:
        raise HTTPException(404, "Lead not found")
    return row


@router.get("/lead/{lead_id}/briefing", response_model=BriefingResponse)
async def get_briefing(lead_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(LeadRow, lead_id)
    if not row:
        raise HTTPException(404, "Lead not found")
    if row.status in ("pending", "processing"):
        return JSONResponse(status_code=202, content={"status": "processing"})
    if row.status == "error":
        raise HTTPException(500, detail="Pipeline failed")
    return BriefingResponse(**row.briefing_data)


@router.get("/leads", response_model=list[LeadResponse])
async def list_leads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LeadRow).order_by(LeadRow.created_at.desc()).limit(50))
    return result.scalars().all()
