import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import admin, github, projects, repositories, webhooks
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
settings = get_settings()

fastapi_app = FastAPI(title="RepoLens API")

fastapi_app.include_router(projects.router, prefix="/api")
fastapi_app.include_router(repositories.router, prefix="/api")
fastapi_app.include_router(github.router, prefix="/api")
fastapi_app.include_router(admin.router, prefix="/api")
fastapi_app.include_router(webhooks.router, prefix="/api")


@fastapi_app.middleware("http")
async def log_requests(request, call_next):
    response = await call_next(request)
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


@fastapi_app.get("/health")
async def health():
    return {"status": "ok"}

@fastapi_app.get("/")
async def root():
    return {"message": "Welcome to the RepoLens API!"}    


app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
