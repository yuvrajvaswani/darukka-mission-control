from fastapi import APIRouter

from app.api.v1 import auth, projects, sites, analytics

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(sites.router)
api_router.include_router(analytics.router)
