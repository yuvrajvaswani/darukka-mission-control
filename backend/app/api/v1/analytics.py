from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analytics import AnalyticsRecord
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsCreate,
    AnalyticsOut,
    TimeSeriesOut,
    TimeSeriesPoint,
)
from app.services.insights import generate_insights

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/", response_model=AnalyticsOut, status_code=status.HTTP_201_CREATED)
async def create_record(
    payload: AnalyticsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_site_accessible(payload.site_id, current_user.id, db)
    record = AnalyticsRecord(**payload.model_dump())
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("/site/{site_id}/timeseries", response_model=TimeSeriesOut)
async def get_timeseries(
    site_id: uuid.UUID,
    metric_name: str = Query(..., min_length=1, max_length=100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_site_accessible(site_id, current_user.id, db)

    stmt = (
        select(AnalyticsRecord)
        .where(
            AnalyticsRecord.site_id == site_id,
            AnalyticsRecord.metric_name == metric_name,
        )
        .order_by(AnalyticsRecord.observed_on)
    )
    if start_date:
        stmt = stmt.where(AnalyticsRecord.observed_on >= start_date)
    if end_date:
        stmt = stmt.where(AnalyticsRecord.observed_on <= end_date)

    result = await db.execute(stmt)
    records = result.scalars().all()

    return TimeSeriesOut(
        site_id=site_id,
        metric_name=metric_name,
        data=[
            TimeSeriesPoint(
                observed_on=r.observed_on,
                metric_value=r.metric_value,
                confidence=r.confidence,
            )
            for r in records
        ],
    )


@router.get("/site/{site_id}/insights")
async def get_insights(
    site_id: uuid.UUID,
    metric_name: str = Query(..., min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return rule-based text insights for the latest data window."""
    await _assert_site_accessible(site_id, current_user.id, db)

    result = await db.execute(
        select(AnalyticsRecord)
        .where(
            AnalyticsRecord.site_id == site_id,
            AnalyticsRecord.metric_name == metric_name,
        )
        .order_by(AnalyticsRecord.observed_on.desc())
        .limit(90)  # last ~3 months of daily observations
    )
    records = result.scalars().all()
    values = [r.metric_value for r in records]
    return {"site_id": str(site_id), "metric_name": metric_name, "insights": generate_insights(metric_name, values)}


@router.get("/site/{site_id}", response_model=list[AnalyticsOut])
async def list_records(
    site_id: uuid.UUID,
    skip: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_site_accessible(site_id, current_user.id, db)
    result = await db.execute(
        select(AnalyticsRecord)
        .where(AnalyticsRecord.site_id == site_id)
        .order_by(AnalyticsRecord.observed_on.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AnalyticsRecord)
        .join(Site, AnalyticsRecord.site_id == Site.id)
        .join(Project, Site.project_id == Project.id)
        .where(AnalyticsRecord.id == record_id, Project.owner_id == current_user.id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    await db.delete(record)


# ── helpers ───────────────────────────────────────────────────────────────────

async def _assert_site_accessible(
    site_id: uuid.UUID, owner_id: uuid.UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Site)
        .join(Project, Site.project_id == Project.id)
        .where(Site.id == site_id, Project.owner_id == owner_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
