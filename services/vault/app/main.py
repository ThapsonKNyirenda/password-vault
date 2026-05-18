from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.bootstrap.seed import ensure_seed_identities
from app.core.config import get_settings
from app.services.audit_service import reset_audit_request_context, set_audit_request_context


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Centralized password vault with local agent execution model",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def audit_request_context(request: Request, call_next):
    token = set_audit_request_context(request)
    try:
        return await call_next(request)
    finally:
        reset_audit_request_context(token)


api_prefix = "/api/v1"
app.include_router(api_v1_router, prefix=api_prefix)


@app.on_event("startup")
def startup() -> None:
    # Migrations run via separate init container (make seed)
    # to avoid race conditions with multiple workers
    print("starting ensure_seed_identities")
    ensure_seed_identities()
    print("finished ensure_seed_identities")


@app.get("/healthz", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "ok",
        "docs": "/docs",
        "api_prefix": api_prefix,
    }
