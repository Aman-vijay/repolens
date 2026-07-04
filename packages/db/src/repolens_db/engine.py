import os
from functools import lru_cache

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool


def _build_url():
    database_url = os.environ.get("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    url = make_url(database_url)
    if url.query:
        url = url.difference_update_query(set(url.query.keys()))
    return url


@lru_cache
def get_engine():
    url = _build_url()
    connect_args = {}
    if "postgres" in url.drivername or "psycopg" in url.drivername:
        connect_args = {"ssl": "require"}

    return create_async_engine(
        url,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args=connect_args,
    )


@lru_cache
def get_async_session_factory():
    return async_sessionmaker(
        get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


def __getattr__(name: str):
    if name == "engine":
        return get_engine()
    if name == "async_session_factory":
        return get_async_session_factory()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
