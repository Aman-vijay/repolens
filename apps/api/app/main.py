"""RepoLens FastAPI application.

Standardized Request Lifecycle (per endpoint):
  1. Data Validation    — Pydantic validates the request body before the handler
  2. Rate Limiting       — slowapi checks Redis (keyed by user/IP + endpoint)
  3. Authentication      — FastAPI Depends(get_current_user) verifies Clerk JWT
  4. Authorization       — Depends(get_current_superuser) for admin routes
  5. Handler Execution   — thin route calls service layer (business logic)
  6. Standardized Response — FastAPI serializes via response_model (success)
                            or custom exception handler (error)

Architecture:
  routes/     Thin handlers — deps + schema + call service → respond
  services/   Business logic — all DB queries, external API calls, validation
  schemas/    Per-domain Pydantic models + rate-limit metadata + access level
  deps.py     Auth dependencies (get_current_user, get_current_superuser)
  middleware/ Rate limiting, request logging
  settings.py Lazy configuration (no env-var validation at import time)
"""
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from fastapi.exceptions import RequestValidationError

from app.middleware.rate_limit import limiter
from app.routes import admin, github, projects, repositories, search, webhooks, analysis, chat, plans
from app.settings import get_settings

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
)

logger = structlog.get_logger()

fastapi_app = FastAPI(title="RepoLens API")

# --- Rate limiting ---
fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Routers ---
fastapi_app.include_router(projects.router, prefix="/api")
fastapi_app.include_router(repositories.router, prefix="/api")
fastapi_app.include_router(github.router, prefix="/api")
fastapi_app.include_router(search.router, prefix="/api")
fastapi_app.include_router(analysis.router, prefix="/api")
fastapi_app.include_router(chat.router, prefix="/api")
fastapi_app.include_router(plans.router, prefix="/api")
fastapi_app.include_router(admin.router, prefix="/api")
fastapi_app.include_router(webhooks.router, prefix="/api")

# --- Request logging middleware ---
@fastapi_app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


# --- Standardized error handler ---
@fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Retrieve request body safely
    body = b""
    try:
        body = await request.body()
    except Exception:
        pass
    logger.error(
        "request_validation_error",
        method=request.method,
        path=request.url.path,
        errors=exc.errors(),
        body=body.decode("utf-8", errors="ignore")
    )
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": body.decode("utf-8", errors="ignore")
        }
    )

@fastapi_app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_error",
        method=request.method,
        path=request.url.path,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {"code": "INTERNAL", "message": "An unexpected error occurred."},
        },
    )


@fastapi_app.get("/health")
async def health():
    return {"status": "ok"}


@fastapi_app.get("/")
async def root():
    return {"message": "Welcome to the RepoLens API!"}


settings = get_settings()

app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)