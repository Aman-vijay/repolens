"""Standardized API response envelope.

All API responses follow this shape on success:
  {"status": "ok", "data": <payload>}

On error, the custom exception handler returns:
  {"status": "error", "error": {"code": "<ERROR_CODE>", "message": "..."}}
"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    status: str = "ok"
    data: T


class APIError(BaseModel):
    status: str = "error"
    error: dict  # {"code": str, "message": str}