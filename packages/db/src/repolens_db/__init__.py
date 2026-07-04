from repolens_db.base import Base
from repolens_db.engine import get_async_session_factory, get_engine
from repolens_db.models import Project, Repository, User

__all__ = [
    "Base",
    "Project",
    "Repository",
    "User",
    "engine",
    "async_session_factory",
    "get_engine",
    "get_async_session_factory",
]


def __getattr__(name: str):
    if name == "engine":
        return get_engine()
    if name == "async_session_factory":
        return get_async_session_factory()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
