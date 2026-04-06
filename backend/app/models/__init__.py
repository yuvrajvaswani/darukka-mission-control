# Re-export all models so Alembic can discover them via `from app.models import *`
from app.models.analytics import AnalyticsRecord
from app.models.project import Project
from app.models.site import Site
from app.models.user import User

__all__ = ["User", "Project", "Site", "AnalyticsRecord"]
