from fastapi import APIRouter

from app.api.v1.endpoints import access, admin, agent, audit, auth


router = APIRouter()

router.include_router(auth.router)
router.include_router(admin.router)
router.include_router(access.router)
router.include_router(agent.router)
router.include_router(audit.router)
