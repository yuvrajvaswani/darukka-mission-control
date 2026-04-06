from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── GeoJSON helpers ───────────────────────────────────────────────────────────

class GeoJSONPolygon(BaseModel):
    """Minimal GeoJSON Polygon validation."""

    type: str = Field(pattern="^Polygon$")
    coordinates: list[list[list[float]]]

    @model_validator(mode="after")
    def validate_ring(self) -> "GeoJSONPolygon":
        if not self.coordinates or len(self.coordinates[0]) < 4:
            raise ValueError(
                "Polygon exterior ring must have at least 4 coordinate pairs "
                "(first and last must match to close the ring)."
            )
        ring = self.coordinates[0]
        if ring[0] != ring[-1]:
            raise ValueError("Polygon exterior ring must be closed (first == last point).")
        return self


# ── Site schemas ──────────────────────────────────────────────────────────────

class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    site_type: str = Field(
        default="general", pattern="^(general|monitoring|exclusion)$"
    )
    geometry: GeoJSONPolygon


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    site_type: str | None = Field(
        default=None, pattern="^(general|monitoring|exclusion)$"
    )
    geometry: GeoJSONPolygon | None = None


class SiteOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    site_type: str
    project_id: UUID
    centroid_lat: float | None
    centroid_lon: float | None
    geometry: Any | None = None  # returned as GeoJSON dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
