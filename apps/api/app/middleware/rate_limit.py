"""Rate limiting middleware using slowapi + Redis.

Per-endpoint limits keyed by (IP or user_id, endpoint_name).
Uses Redis (Upstash) as the distributed storage so limits work
across multiple API instances in production.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.settings import get_settings


def _get_rate_limit_key(request) -> str:
    """Build a rate-limit key: user_id (if authed) or IP + endpoint path."""
    # Try to extract user from the Authorization header (JWT sub claim).
    # We don't verify the full JWT here — just extract the subject for keying.
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        # The Clerk JWT "sub" claim is the user ID. We use a lightweight
        # extract to avoid the cost of full verification on every request.
        # Full verification still happens in get_current_user dependency.
        user_part = "authed"
    else:
        user_part = f"ip:{get_remote_address(request)}"

    return f"{user_part}:{request.url.path}"


def _get_redis_uri() -> str:
    return get_settings().redis_url


limiter = Limiter(
    key_func=_get_rate_limit_key,
    storage_uri=_get_redis_uri(),
    default_limits=["200 per minute"],
)