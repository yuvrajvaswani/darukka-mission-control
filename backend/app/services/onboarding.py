"""
Auto-seed default sample projects/sites for every new user on registration.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from geoalchemy2.elements import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsRecord
from app.models.project import Project
from app.models.site import Site

_SITES_DATA = [
    {
        "name": "Northern Forest Zone A",
        "description": "Primary monitoring zone for deforestation tracking",
        "site_type": "monitoring",
        "centroid_lat": 51.505,
        "centroid_lon": -0.09,
        "wkt": "POLYGON((-0.11 51.49, -0.07 51.49, -0.07 51.52, -0.11 51.52, -0.11 51.49))",
        "project_index": 0,
    },
    {
        "name": "Wetland Reserve B",
        "description": "Seasonal wetland moisture analysis",
        "site_type": "monitoring",
        "centroid_lat": 51.525,
        "centroid_lon": -0.15,
        "wkt": "POLYGON((-0.17 51.51, -0.13 51.51, -0.13 51.54, -0.17 51.54, -0.17 51.51))",
        "project_index": 0,
    },
    {
        "name": "Exclusion Buffer C",
        "description": "Protected corridor — no-fly zone",
        "site_type": "exclusion",
        "centroid_lat": 51.49,
        "centroid_lon": -0.05,
        "wkt": "POLYGON((-0.07 51.48, -0.03 51.48, -0.03 51.50, -0.07 51.50, -0.07 51.48))",
        "project_index": 0,
    },
    {
        "name": "Savanna Patch D",
        "description": "Vegetation recovery after controlled burn",
        "site_type": "general",
        "centroid_lat": -1.286,
        "centroid_lon": 36.817,
        "wkt": "POLYGON((36.80 -1.30, 36.84 -1.30, 36.84 -1.27, 36.80 -1.27, 36.80 -1.30))",
        "project_index": 1,
    },
    {
        "name": "Coastal Survey E",
        "description": "Tidal erosion and mangrove extent tracking",
        "site_type": "monitoring",
        "centroid_lat": -1.31,
        "centroid_lon": 36.845,
        "wkt": "POLYGON((36.83 -1.33, 36.86 -1.33, 36.86 -1.29, 36.83 -1.29, 36.83 -1.33))",
        "project_index": 1,
    },
    {
        "name": "Alpine Meadow F",
        "description": "Snow cover and NDVI seasonal comparison",
        "site_type": "monitoring",
        "centroid_lat": 46.818,
        "centroid_lon": 8.227,
        "wkt": "POLYGON((8.21 46.81, 8.24 46.81, 8.24 46.83, 8.21 46.83, 8.21 46.81))",
        "project_index": 2,
    },
]

_PROJECTS_DATA = [
    {
        "name": "Operation Greenwatch",
        "description": "Pan-European forest cover change detection using multi-spectral imagery.",
        "status": "active",
    },
    {
        "name": "Nairobi Basin Hydrology",
        "description": "Seasonal flood risk modeling and wetland extent mapping across the basin.",
        "status": "active",
    },
    {
        "name": "Alpine Snow Survey 2024",
        "description": "Completed annual survey of snowpack depth and extent for climate baselines.",
        "status": "completed",
    },
    {
        "name": "Legacy Coastal Archive",
        "description": "Archived project — historical tidal erosion records (2018–2022).",
        "status": "archived",
    },
]


def _gen_analytics(site_id, metric: str, base: float, noise: float, months: int = 18):
    records = []
    start = date.today() - timedelta(days=30 * months)
    for i in range(months):
        obs = start + timedelta(days=30 * i)
        value = round(base + random.uniform(-noise, noise) + i * 0.005, 4)
        records.append(
            AnalyticsRecord(
                site_id=site_id,
                observed_on=obs,
                metric_name=metric,
                metric_value=max(0.0, min(1.0, value)) if metric != "temperature" else value,
                confidence=round(random.uniform(0.75, 0.99), 2),
                data_source="Sentinel-2",
            )
        )
    return records


async def seed_default_projects(user_id: int, db: AsyncSession) -> None:
    """Create sample projects, sites, and analytics for a newly registered user."""
    projects = [
        Project(
            name=p["name"],
            description=p["description"],
            status=p["status"],
            owner_id=user_id,
        )
        for p in _PROJECTS_DATA
    ]
    db.add_all(projects)
    await db.flush()

    site_objs = []
    for s in _SITES_DATA:
        site = Site(
            name=s["name"],
            description=s["description"],
            site_type=s["site_type"],
            centroid_lat=s["centroid_lat"],
            centroid_lon=s["centroid_lon"],
            geometry=WKTElement(s["wkt"], srid=4326),
            project_id=projects[s["project_index"]].id,
        )
        db.add(site)
        site_objs.append(site)

    await db.flush()

    metrics = [
        ("ndvi", 0.62, 0.12),
        ("moisture", 0.45, 0.10),
        ("temperature", 18.5, 4.0),
    ]
    for site in site_objs:
        for metric, base, noise in metrics:
            db.add_all(_gen_analytics(site.id, metric, base, noise))
