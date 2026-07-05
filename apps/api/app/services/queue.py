"""ARQ queue service for the API — enqueues jobs to the worker via Redis."""
from functools import lru_cache
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import RedisSettings

from app.settings import get_settings

_pool = None


def _parse_redis_settings(redis_url: str) -> RedisSettings:
    parsed = urlparse(redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password or None,
        ssl=parsed.scheme == "rediss",
    )


async def get_arq_pool():
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await create_pool(_parse_redis_settings(settings.redis_url))
    return _pool


async def enqueue_clone(repository_id: str) -> None:
    pool = await get_arq_pool()
    await pool.enqueue_job("clone_repository", repository_id=repository_id)


async def enqueue_analysis(repository_id: str, force: bool = False) -> None:
    pool = await get_arq_pool()
    await pool.enqueue_job("analyze_repository", repository_id=repository_id, force=force)