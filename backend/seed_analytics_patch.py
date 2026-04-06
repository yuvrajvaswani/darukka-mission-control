"""
Adds carbon and biodiversity metric records to already-seeded sites.
Run from backend/ directory:
    python seed_analytics_patch.py
"""
from __future__ import annotations

import asyncio
import random
from datetime import date, timedelta

import sqlalchemy as sa

from app.db.session import AsyncSessionLocal
from app.models.analytics import AnalyticsRecord
from app.models.site import Site


def _gen_series(site_id, metric: str, base: float, noise: float, trend: float = 0.008, months: int = 18):
    records = []
    start = date.today() - timedelta(days=30 * months)
    for i in range(months):
        obs = start + timedelta(days=30 * i)
        value = base + i * trend + random.uniform(-noise, noise)
        records.append(
            AnalyticsRecord(
                site_id=site_id,
                observed_on=obs,
                metric_name=metric,
                metric_value=round(max(0.0, value), 3),
                confidence=round(random.uniform(0.78, 0.97), 2),
                data_source="Sentinel-2 / GBIF",
            )
        )
    return records


# Per-site tuning so sites have different "stories"
SITE_PROFILES = [
    {"carbon_base": 82.4,  "carbon_trend":  0.30, "bio_base": 67.0, "bio_trend":  0.25},
    {"carbon_base": 54.1,  "carbon_trend": -0.20, "bio_base": 45.5, "bio_trend": -0.18},
    {"carbon_base": 38.7,  "carbon_trend":  0.05, "bio_base": 31.2, "bio_trend":  0.10},
    {"carbon_base": 110.3, "carbon_trend":  0.55, "bio_base": 78.4, "bio_trend":  0.40},
    {"carbon_base": 71.6,  "carbon_trend": -0.35, "bio_base": 60.1, "bio_trend": -0.30},
    {"carbon_base": 46.9,  "carbon_trend":  0.15, "bio_base": 52.8, "bio_trend":  0.20},
]


async def patch():
    async with AsyncSessionLocal() as db:
        result = await db.execute(sa.select(Site).order_by(Site.created_at))
        sites = result.scalars().all()
        if not sites:
            print("No sites found — run seed.py first.")
            return

        # Check if already patched
        check = await db.execute(
            sa.select(AnalyticsRecord)
            .where(AnalyticsRecord.metric_name == "carbon")
            .limit(1)
        )
        if check.scalar_one_or_none():
            print("Carbon/biodiversity data already exists. Skipping.")
            return

        total = 0
        for i, site in enumerate(sites):
            profile = SITE_PROFILES[i % len(SITE_PROFILES)]
            carbon_records = _gen_series(
                site.id, "carbon",
                base=profile["carbon_base"], noise=4.5,
                trend=profile["carbon_trend"],
            )
            bio_records = _gen_series(
                site.id, "biodiversity",
                base=profile["bio_base"], noise=3.2,
                trend=profile["bio_trend"],
            )
            db.add_all(carbon_records)
            db.add_all(bio_records)
            total += len(carbon_records) + len(bio_records)

        await db.commit()
        print(f"Patched: {total} carbon + biodiversity records across {len(sites)} sites.")


if __name__ == "__main__":
    asyncio.run(patch())
