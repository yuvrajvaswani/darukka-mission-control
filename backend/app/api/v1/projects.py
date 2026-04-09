import random
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analytics import AnalyticsRecord
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(**payload.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectOut])
async def list_projects(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project)
        .where(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_owned_project(project_id, current_user.id, db)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_owned_project(project_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _get_owned_project(project_id, current_user.id, db)
    await db.delete(project)


# ── helpers ───────────────────────────────────────────────────────────────────

_DEMO_SITES = [
    {"name": "Northern Forest Zone A", "description": "Primary monitoring zone for deforestation tracking",
     "site_type": "monitoring", "centroid_lat": 51.505, "centroid_lon": -0.09,
     "wkt": "POLYGON((-0.11 51.49, -0.07 51.49, -0.07 51.52, -0.11 51.52, -0.11 51.49))"},
    {"name": "Wetland Reserve B", "description": "Seasonal wetland moisture analysis",
     "site_type": "monitoring", "centroid_lat": 51.525, "centroid_lon": -0.15,
     "wkt": "POLYGON((-0.17 51.51, -0.13 51.51, -0.13 51.54, -0.17 51.54, -0.17 51.51))"},
    {"name": "Exclusion Buffer C", "description": "Protected corridor — no-fly zone",
     "site_type": "exclusion", "centroid_lat": 51.49, "centroid_lon": -0.05,
     "wkt": "POLYGON((-0.07 51.48, -0.03 51.48, -0.03 51.50, -0.07 51.50, -0.07 51.48))"},
    {"name": "Savanna Patch D", "description": "Vegetation recovery after controlled burn",
     "site_type": "general", "centroid_lat": -1.286, "centroid_lon": 36.817,
     "wkt": "POLYGON((36.80 -1.30, 36.84 -1.30, 36.84 -1.27, 36.80 -1.27, 36.80 -1.30))"},
    {"name": "Coastal Survey E", "description": "Tidal erosion and mangrove extent tracking",
     "site_type": "monitoring", "centroid_lat": -1.31, "centroid_lon": 36.845,
     "wkt": "POLYGON((36.83 -1.33, 36.86 -1.33, 36.86 -1.29, 36.83 -1.29, 36.83 -1.33))"},
    {"name": "Alpine Meadow F", "description": "Snow cover and NDVI seasonal comparison",
     "site_type": "monitoring", "centroid_lat": 46.818, "centroid_lon": 8.227,
     "wkt": "POLYGON((8.21 46.81, 8.24 46.81, 8.24 46.83, 8.21 46.83, 8.21 46.81))"},
]

_DEMO_SITE_PROFILES = [
    {"carbon_base": 82.4,  "carbon_trend":  0.30, "bio_base": 67.0, "bio_trend":  0.25},
    {"carbon_base": 54.1,  "carbon_trend": -0.20, "bio_base": 45.5, "bio_trend": -0.18},
    {"carbon_base": 38.7,  "carbon_trend":  0.05, "bio_base": 31.2, "bio_trend":  0.10},
    {"carbon_base": 110.3, "carbon_trend":  0.55, "bio_base": 78.4, "bio_trend":  0.40},
    {"carbon_base": 71.6,  "carbon_trend": -0.35, "bio_base": 60.1, "bio_trend": -0.30},
    {"carbon_base": 46.9,  "carbon_trend":  0.15, "bio_base": 52.8, "bio_trend":  0.20},
]


def _make_series(site_id, metric: str, base: float, noise: float, trend: float, months: int = 18):
    start = date.today() - timedelta(days=30 * months)
    return [
        AnalyticsRecord(
            site_id=site_id,
            observed_on=start + timedelta(days=30 * i),
            metric_name=metric,
            metric_value=round(max(0.0, base + i * trend + random.uniform(-noise, noise)), 3),
            confidence=round(random.uniform(0.78, 0.97), 2),
            data_source="Sentinel-2 / GBIF",
        )
        for i in range(months)
    ]


@router.post("/seed-demo", response_model=list[ProjectOut], status_code=status.HTTP_201_CREATED)
async def seed_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Populate the current user's account with sample projects, sites, and analytics.
    Returns 409 if demo data already exists."""
    existing = await db.execute(select(Project).where(Project.owner_id == current_user.id).limit(1))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your account already has projects. Delete them first or use a fresh account.",
        )

    projects = [
        Project(name="Operation Greenwatch",
                description="Pan-European forest cover change detection using multi-spectral imagery.",
                status="active", owner_id=current_user.id),
        Project(name="Nairobi Basin Hydrology",
                description="Seasonal flood risk modeling and wetland extent mapping.",
                status="active", owner_id=current_user.id),
        Project(name="Alpine Snow Survey 2024",
                description="Completed annual survey of snowpack depth and extent for climate baselines.",
                status="completed", owner_id=current_user.id),
        Project(name="Legacy Coastal Archive",
                description="Archived project — historical tidal erosion records (2018–2022).",
                status="archived", owner_id=current_user.id),
    ]
    db.add_all(projects)
    await db.flush()

    project_map = [projects[0], projects[0], projects[0], projects[1], projects[1], projects[2]]
    site_objs = []
    for i, s in enumerate(_DEMO_SITES):
        site = Site(
            name=s["name"], description=s["description"], site_type=s["site_type"],
            centroid_lat=s["centroid_lat"], centroid_lon=s["centroid_lon"],
            geometry=WKTElement(s["wkt"], srid=4326),
            project_id=project_map[i].id,
        )
        db.add(site)
        site_objs.append(site)
    await db.flush()

    for i, site in enumerate(site_objs):
        p = _DEMO_SITE_PROFILES[i]
        db.add_all(_make_series(site.id, "carbon", p["carbon_base"], 4.5, p["carbon_trend"]))
        db.add_all(_make_series(site.id, "biodiversity", p["bio_base"], 3.2, p["bio_trend"]))
        db.add_all(_make_series(site.id, "ndvi", 0.62, 0.12, 0.005))
        db.add_all(_make_series(site.id, "moisture", 0.45, 0.10, 0.003))

    await db.flush()
    await db.refresh(projects[0])
    await db.refresh(projects[1])
    await db.refresh(projects[2])
    await db.refresh(projects[3])
    return projects


async def _get_owned_project(
    project_id: uuid.UUID, owner_id: uuid.UUID, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
