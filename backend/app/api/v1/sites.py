from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_Centroid, ST_GeomFromGeoJSON, ST_SetSRID
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.site import SiteCreate, SiteOut, SiteUpdate

router = APIRouter(prefix="/sites", tags=["sites"])


@router.post("/", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(
    payload: SiteCreate,
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_project_owned(project_id, current_user.id, db)

    geojson_str = payload.geometry.model_dump_json()
    geom_expr = ST_SetSRID(ST_GeomFromGeoJSON(geojson_str), 4326)

    # Calculate centroid synchronously via a scalar subquery
    centroid_result = await db.execute(
        select(
            func.ST_Y(ST_Centroid(geom_expr)).label("lat"),
            func.ST_X(ST_Centroid(geom_expr)).label("lon"),
        )
    )
    row = centroid_result.one()

    site = Site(
        name=payload.name,
        description=payload.description,
        site_type=payload.site_type,
        project_id=project_id,
        geometry=geom_expr,
        centroid_lat=row.lat,
        centroid_lon=row.lon,
    )
    db.add(site)
    await db.flush()
    await db.refresh(site)
    return await _serialize_site(site, db)


@router.get("/", response_model=list[SiteOut])
async def list_sites(
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _assert_project_owned(project_id, current_user.id, db)
    result = await db.execute(
        select(Site)
        .where(Site.project_id == project_id)
        .order_by(Site.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    sites = result.scalars().all()
    return [await _serialize_site(s, db) for s in sites]


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(
    site_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await _get_accessible_site(site_id, current_user.id, db)
    return await _serialize_site(site, db)


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: uuid.UUID,
    payload: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await _get_accessible_site(site_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True)

    if "geometry" in update_data and update_data["geometry"] is not None:
        geo = update_data.pop("geometry")
        geojson_str = json.dumps(geo)
        geom_expr = ST_SetSRID(ST_GeomFromGeoJSON(geojson_str), 4326)
        centroid_result = await db.execute(
            select(
                func.ST_Y(ST_Centroid(geom_expr)).label("lat"),
                func.ST_X(ST_Centroid(geom_expr)).label("lon"),
            )
        )
        row = centroid_result.one()
        site.geometry = geom_expr
        site.centroid_lat = row.lat
        site.centroid_lon = row.lon

    for field, value in update_data.items():
        setattr(site, field, value)

    await db.flush()
    await db.refresh(site)
    return await _serialize_site(site, db)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    site_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = await _get_accessible_site(site_id, current_user.id, db)
    await db.delete(site)


# ── helpers ───────────────────────────────────────────────────────────────────

async def _assert_project_owned(
    project_id: uuid.UUID, owner_id: uuid.UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


async def _get_accessible_site(
    site_id: uuid.UUID, owner_id: uuid.UUID, db: AsyncSession
) -> Site:
    """Return a Site the current user owns (via project ownership)."""
    result = await db.execute(
        select(Site)
        .join(Project, Site.project_id == Project.id)
        .where(Site.id == site_id, Project.owner_id == owner_id)
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site


async def _serialize_site(site: Site, db: AsyncSession) -> SiteOut:
    """Convert WKB geometry to a GeoJSON dict for the response."""
    geojson: dict | None = None
    if site.geometry is not None:
        geo_result = await db.execute(
            select(ST_AsGeoJSON(site.geometry).label("geojson"))
        )
        raw = geo_result.scalar_one_or_none()
        if raw:
            geojson = json.loads(raw)

    data = {
        "id": site.id,
        "name": site.name,
        "description": site.description,
        "site_type": site.site_type,
        "project_id": site.project_id,
        "centroid_lat": site.centroid_lat,
        "centroid_lon": site.centroid_lon,
        "geometry": geojson,
        "created_at": site.created_at,
        "updated_at": site.updated_at,
    }
    return SiteOut.model_validate(data)
