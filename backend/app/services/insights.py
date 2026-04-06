"""
Rule-based insight generation for analytics data.

This module produces human-readable text insights from time-series float values.
It is intentionally deterministic (no LLM dependency) so it always works offline
and can later be swapped for an AI backend without changing the API contract.
"""
from __future__ import annotations

from statistics import mean, stdev
from typing import Sequence


def generate_insights(metric_name: str, values: Sequence[float]) -> list[str]:
    """
    Generate plain-English insights for a list of values (newest-first order).

    Args:
        metric_name: e.g. "ndvi", "temperature", "moisture"
        values: sequence of float observations, most recent first.

    Returns:
        A list of insight strings (empty list if insufficient data).
    """
    if not values:
        return ["No data available for this metric yet."]

    insights: list[str] = []
    label = metric_name.upper()
    vals = list(values)  # copy – newest first

    # ── Trend (compare first half vs second half) ─────────────────────────────
    if len(vals) >= 6:
        mid = len(vals) // 2
        recent_mean = mean(vals[:mid])
        older_mean = mean(vals[mid:])
        pct_change = ((recent_mean - older_mean) / (abs(older_mean) + 1e-9)) * 100

        if pct_change > 10:
            insights.append(
                f"{label} has increased by {pct_change:.1f}% over the observation window, "
                "indicating a positive trend."
            )
        elif pct_change < -10:
            insights.append(
                f"{label} has decreased by {abs(pct_change):.1f}% over the observation window — "
                "this warrants attention."
            )
        else:
            insights.append(f"{label} has remained relatively stable (±{abs(pct_change):.1f}%).")

    # ── Current value vs overall mean ─────────────────────────────────────────
    overall_mean = mean(vals)
    current = vals[0]
    if abs(overall_mean) > 1e-9:
        diff_pct = ((current - overall_mean) / abs(overall_mean)) * 100
        if diff_pct > 15:
            insights.append(
                f"The latest {label} value ({current:.3f}) is {diff_pct:.1f}% above the "
                "historical average — a notable high."
            )
        elif diff_pct < -15:
            insights.append(
                f"The latest {label} value ({current:.3f}) is {abs(diff_pct):.1f}% below the "
                "historical average — a notable low."
            )

    # ── Volatility ───────────────────────────────────────────────────────────
    if len(vals) >= 3:
        std = stdev(vals)
        cv = std / (abs(overall_mean) + 1e-9)  # coefficient of variation
        if cv > 0.3:
            insights.append(
                f"High variability detected in {label} (CV={cv:.2f}). "
                "Data may reflect changing environmental conditions."
            )
        elif cv < 0.05:
            insights.append(f"{label} shows very low variability — conditions are consistent.")

    # ── Metric-specific thresholds ────────────────────────────────────────────
    if metric_name.lower() == "ndvi":
        if current < 0.2:
            insights.append(
                "NDVI below 0.2 suggests sparse or no vegetation. "
                "Possible bare soil, urban surface, or vegetation stress."
            )
        elif current > 0.6:
            insights.append("NDVI above 0.6 indicates dense, healthy vegetation cover.")
    elif metric_name.lower() == "temperature":
        if current > 40:
            insights.append(
                "Temperature exceeds 40°C — extreme heat stress likely for vegetation."
            )
        elif current < 0:
            insights.append("Sub-zero temperatures detected. Frost risk is present.")
    elif metric_name.lower() == "moisture":
        if current < 0.15:
            insights.append("Soil moisture is critically low. Drought conditions possible.")
        elif current > 0.85:
            insights.append("Very high moisture levels — risk of waterlogging or flood.")
    elif metric_name.lower() == "carbon":
        if len(vals) >= 6:
            mid = len(vals) // 2
            recent_mean = mean(vals[:mid])
            older_mean = mean(vals[mid:])
            pct = ((recent_mean - older_mean) / (abs(older_mean) + 1e-9)) * 100
            if pct > 5:
                insights.append(
                    f"Carbon levels increased by {pct:.1f}% — indicating positive sequestration "
                    "and likely healthy vegetation growth."
                )
            elif pct < -5:
                insights.append(
                    f"Carbon levels declined by {abs(pct):.1f}% — possible deforestation, "
                    "land degradation, or reduced biomass."
                )
        if current > 100:
            insights.append(
                f"Carbon stock ({current:.1f} t/ha) is above 100 t/ha — high-density biomass zone."
            )
        elif current < 30:
            insights.append(
                f"Carbon stock ({current:.1f} t/ha) is low. Site may benefit from reforestation."
            )
    elif metric_name.lower() == "biodiversity":
        if len(vals) >= 6:
            mid = len(vals) // 2
            recent_mean = mean(vals[:mid])
            older_mean = mean(vals[mid:])
            pct = ((recent_mean - older_mean) / (abs(older_mean) + 1e-9)) * 100
            if pct > 5:
                insights.append(
                    f"Biodiversity index rose by {pct:.1f}% — species richness is improving. "
                    "Conservation efforts appear effective."
                )
            elif pct < -5:
                insights.append(
                    f"Biodiversity index dropped by {abs(pct):.1f}% — habitat loss or invasive "
                    "species pressure may be a factor."
                )
        if current > 80:
            insights.append(
                f"Biodiversity score of {current:.1f} is excellent — this site hosts rich species diversity."
            )
        elif current < 30:
            insights.append(
                f"Biodiversity score of {current:.1f} is critically low. Intervention recommended."
            )

    if not insights:
        insights.append(f"{label} data is within normal expected ranges.")

    return insights
