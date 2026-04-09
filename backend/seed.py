"""
Seed the database with sample projects, sites, and analytics data.
Run from the backend/ directory:
    python seed.py                        # seeds the first user in the DB
    python seed.py --email you@example.com  # seeds a specific account
    python seed.py --email you@example.com --force  # re-seed even if data exists
"""
from __future__ import annotations

import argparse
import asyncio
import random
from datetime import date, timedelta

import sqlalchemy as sa
from geoalchemy2.elements import WKTElement

from app.db.session import AsyncSessionLocal
from app.models.analytics import AnalyticsRecord
from app.models.project import Project
from app.models.site import Site
from app.models.user import User

# ── Sample polygons (WGS84) in different parts of the world ──────────────────
SITES_DATA = [
    {
        "name": "Northern Forest Zone A",
        "description": "Primary monitoring zone for deforestation tracking",
        "site_type": "monitoring",
        "centroid_lat": 51.505,
        "centroid_lon": -0.09,
        "wkt": "POLYGON((-0.11 51.49, -0.07 51.49, -0.07 51.52, -0.11 51.52, -0.11 51.49))",
    },
    {
        "name": "Wetland Reserve B",
        "description": "Seasonal wetland moisture analysis",
        "site_type": "monitoring",
        "centroid_lat": 51.525,
        "centroid_lon": -0.15,
        "wkt": "POLYGON((-0.17 51.51, -0.13 51.51, -0.13 51.54, -0.17 51.54, -0.17 51.51))",
    },
    {
        "name": "Exclusion Buffer C",
        "description": "Protected corridor — no-fly zone",
        "site_type": "exclusion",
        "centroid_lat": 51.49,
        "centroid_lon": -0.05,
        "wkt": "POLYGON((-0.07 51.48, -0.03 51.48, -0.03 51.50, -0.07 51.50, -0.07 51.48))",
    },
    {
        "name": "Savanna Patch D",
        "description": "Vegetation recovery after controlled burn",
        "site_type": "general",
        "centroid_lat": -1.286,
        "centroid_lon": 36.817,
        "wkt": "POLYGON((36.80 -1.30, 36.84 -1.30, 36.84 -1.27, 36.80 -1.27, 36.80 -1.30))",
    },
    {
        "name": "Coastal Survey E",
        "description": "Tidal erosion and mangrove extent tracking",
        "site_type": "monitoring",
        "centroid_lat": -1.31,
        "centroid_lon": 36.845,
        "wkt": "POLYGON((36.83 -1.33, 36.86 -1.33, 36.86 -1.29, 36.83 -1.29, 36.83 -1.33))",
    },
    {
        "name": "Alpine Meadow F",
        "description": "Snow cover and NDVI seasonal comparison",
        "site_type": "monitoring",
        "centroid_lat": 46.818,
        "centroid_lon": 8.227,
        "wkt": "POLYGON((8.21 46.81, 8.24 46.81, 8.24 46.83, 8.21 46.83, 8.21 46.81))",
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


async def seed(email: str | None = None, force: bool = False):
    async with AsyncSessionLocal() as db:
        # Find target user
        if email:
            result = await db.execute(sa.select(User).where(User.email == email))
            user: User | None = result.scalar_one_or_none()
            if not user:
                print(f"No user found with email: {email}")
                print("Make sure you have registered that account first.")
                return
        else:
            result = await db.execute(sa.select(User).limit(1))
            user = result.scalar_one_or_none()
            if not user:
                print("No users found — register an account first, then re-run this script.")
                return

        print(f"Seeding data for user: {user.email}")

        # Check if already seeded
        proj_check = await db.execute(sa.select(Project).where(Project.owner_id == user.id).limit(1))
        if proj_check.scalar_one_or_none():
            if not force:
                print("Data already seeded for this user. Use --force to reseed.")
                return
            print("--force flag set: deleting existing projects for this user and reseeding…")
            existing = await db.execute(sa.select(Project).where(Project.owner_id == user.id))
            for p in existing.scalars().all():
                await db.delete(p)
            await db.flush()

        # ── Projects ────────────────────────────────────────────────────────
        projects = [
            Project(
                name="Operation Greenwatch",
                description="Pan-European forest cover change detection using multi-spectral imagery.",
                status="active",
                owner_id=user.id,
            ),
            Project(
                name="Nairobi Basin Hydrology",
                description="Seasonal flood risk modeling and wetland extent mapping across the basin.",
                status="active",
                owner_id=user.id,
            ),
            Project(
                name="Alpine Snow Survey 2024",
                description="Completed annual survey of snowpack depth and extent for climate baselines.",
                status="completed",
                owner_id=user.id,
            ),
            Project(
                name="Legacy Coastal Archive",
                description="Archived project — historical tidal erosion records (2018–2022).",
                status="archived",
                owner_id=user.id,
            ),
        ]
        db.add_all(projects)
        await db.flush()

        # ── Sites (assign to projects) ────────────────────────────────────
        project_map = [projects[0], projects[0], projects[0], projects[1], projects[1], projects[2]]
        site_objs = []
        for i, s in enumerate(SITES_DATA):
            site = Site(
                name=s["name"],
                description=s["description"],
                site_type=s["site_type"],
                centroid_lat=s["centroid_lat"],
                centroid_lon=s["centroid_lon"],
                geometry=WKTElement(s["wkt"], srid=4326),
                project_id=project_map[i].id,
            )
            db.add(site)
            site_objs.append(site)

        await db.flush()

        # ── Analytics (NDVI + moisture time series per site) ─────────────
        metrics = [
            ("ndvi", 0.62, 0.12),
            ("moisture", 0.45, 0.10),
            ("temperature", 18.5, 4.0),
        ]
        for site in site_objs:
            for metric, base, noise in metrics:
                records = _gen_analytics(site.id, metric, base, noise)
                db.add_all(records)

        await db.commit()

        # Summary
        proj_count = len(projects)
        site_count = len(site_objs)
        analytics_count = site_count * len(metrics) * 18
        print(f"Seeded: {proj_count} projects, {site_count} sites, ~{analytics_count} analytics records.")
        print("Refresh the dashboard — data should appear now!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed sample data for a user account.")
    parser.add_argument("--email", type=str, default=None,
                        help="Email of the account to seed (defaults to first user in DB)")
    parser.add_argument("--force", action="store_true",
                        help="Delete existing seed data and reseed")
    args = parser.parse_args()
    asyncio.run(seed(email=args.email, force=args.force))
