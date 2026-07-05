"""Search service — semantic code search via pgvector cosine similarity."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.search import SearchHitOut
from repolens_db import CodeChunk, Repository


async def search_code(
    db: AsyncSession,
    project_id: uuid.UUID,
    query_embedding: list[float],
    limit: int = 10,
) -> list[SearchHitOut]:
    """Search for code chunks by embedding similarity within a project's repository."""
    # Find the repository for this project
    repo_result = await db.execute(
        select(Repository).where(Repository.project_id == project_id)
    )
    repo = repo_result.scalar_one_or_none()
    if repo is None:
        return []

    # Cosine similarity search via pgvector
    # pgvector's <=> operator = cosine distance; similarity = 1 - distance
    stmt = (
        select(
            CodeChunk,
            CodeChunk.embedding.cosine_distance(query_embedding).label("distance"),
        )
        .where(CodeChunk.repository_id == repo.id)
        .where(CodeChunk.embedding.isnot(None))
        .order_by("distance")
        .limit(limit)
    )

    result = await db.execute(stmt)
    hits: list[SearchHitOut] = []
    for row in result.fetchall():
        chunk = row[0]
        distance = row[1]
        score = 1.0 - distance if distance is not None else 0.0
        hits.append(
            SearchHitOut(
                id=chunk.id,
                file_path=chunk.file_path,
                language=chunk.language,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                content=chunk.content,
                chunk_index=chunk.chunk_index,
                score=round(score, 4),
            )
        )
    return hits