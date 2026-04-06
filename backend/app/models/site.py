import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Site(Base):
    """
    A monitored geographic site that belongs to a project.

    geometry is stored as SRID 4326 (WGS84) Polygon in PostGIS.
    Incoming GeoJSON polygons are cast via ST_GeomFromGeoJSON / ST_SetSRID.
    """

    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_type: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False
    )  # general | monitoring | exclusion

    # PostGIS polygon — stored as WGS84 (SRID 4326)
    geometry: Mapped[bytes | None] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=True,
    )

    # Centroid lat/lon cached for fast marker rendering
    centroid_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    centroid_lon: Mapped[float | None] = mapped_column(Float, nullable=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="sites")  # noqa: F821
    analytics: Mapped[list["AnalyticsRecord"]] = relationship(  # noqa: F821
        "AnalyticsRecord", back_populates="site", cascade="all, delete-orphan"
    )
