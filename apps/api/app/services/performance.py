"""Performance profiling utilities for RepoLens core operations.

This module provides structured logging for latency profiling of:
- Repository Analysis
- Search (semantic embedding + pgvector lookup)
- Chat (grounding retrieval + OpenAI streaming)
- Planner (OpenAI JSON generation)
"""
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import structlog

logger = structlog.get_logger()


@asynccontextmanager
async def profile_latency(operation: str, **kwargs: Any) -> AsyncGenerator[None, None]:
    """Context manager that logs operation latency in milliseconds.

    Usage:
        async with profile_latency("search_embedding", query="user query"):
            embedding = await generate_embedding(query)
    """
    request_id = kwargs.pop("request_id", str(uuid.uuid4())[:8])
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "performance_latency",
            operation=operation,
            latency_ms=round(elapsed_ms, 2),
            request_id=request_id,
            **kwargs,
        )


class LatencyTracker:
    """Tracks cumulative latency for multi-stage operations."""

    def __init__(self, operation: str, request_id: str | None = None):
        self.operation = operation
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self.stages: list[dict[str, Any]] = []
        self._start: float | None = None

    def start_stage(self, stage: str) -> None:
        self._start = time.perf_counter()
        logger.debug("stage_started", operation=self.operation, stage=stage, request_id=self.request_id)

    def end_stage(self, stage: str, **kwargs: Any) -> float:
        if self._start is None:
            raise RuntimeError(f"Stage {stage} was not started")
        elapsed_ms = (time.perf_counter() - self._start) * 1000
        self.stages.append({"stage": stage, "latency_ms": round(elapsed_ms, 2), **kwargs})
        logger.info(
            "stage_completed",
            operation=self.operation,
            stage=stage,
            latency_ms=round(elapsed_ms, 2),
            request_id=self.request_id,
            **kwargs,
        )
        self._start = None
        return elapsed_ms

    def log_total(self, **kwargs: Any) -> float:
        total_ms = sum(s["latency_ms"] for s in self.stages)
        logger.info(
            "operation_completed",
            operation=self.operation,
            total_latency_ms=round(total_ms, 2),
            stages=self.stages,
            request_id=self.request_id,
            **kwargs,
        )
        return total_ms
