from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsCreate(BaseModel):
    site_id: UUID
    observed_on: date
    metric_name: str = Field(min_length=1, max_length=100)
    metric_value: float
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    data_source: str | None = Field(default=None, max_length=100)


class AnalyticsOut(BaseModel):
    id: UUID
    site_id: UUID
    observed_on: date
    metric_name: str
    metric_value: float
    confidence: float | None
    data_source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TimeSeriesPoint(BaseModel):
    observed_on: date
    metric_value: float
    confidence: float | None


class TimeSeriesOut(BaseModel):
    site_id: UUID
    metric_name: str
    data: list[TimeSeriesPoint]
