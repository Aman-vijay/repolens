import os
import uuid
import httpx
from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from repolens_db import CodeChunk, Repository, RepositoryFile, RepositoryAnalysis
from app.settings import get_settings

class SearchResult(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    score: float
    content: str
    symbol_name: Optional[str] = None
    searcher_type: str  # "semantic" | "text" | "file" | "snapshot"

class Searcher(ABC):
    @abstractmethod
    async def search(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        query: str,
        limit: int = 5
    ) -> List[SearchResult]:
        pass

OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"
_httpx_client: Optional[httpx.AsyncClient] = None

def _get_httpx_client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None:
        _httpx_client = httpx.AsyncClient(timeout=15.0)
    return _httpx_client

async def get_query_embedding(query: str) -> List[float]:
    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured")

    client = _get_httpx_client()
    resp = await client.post(
        OPENAI_EMBED_URL,
        json={"model": "text-embedding-3-small", "input": query},
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]


class SemanticSearcher(Searcher):
    async def search(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        query: str,
        limit: int = 5
    ) -> List[SearchResult]:
        try:
            query_embedding = await get_query_embedding(query)
        except Exception:
            return []

        # Cosine distance (1 - similarity)
        stmt = (
            select(
                CodeChunk,
                CodeChunk.embedding.cosine_distance(query_embedding).label("distance")
            )
            .where(CodeChunk.repository_id == repo_id)
            .where(CodeChunk.embedding.isnot(None))
            .order_by("distance")
            .limit(limit)
        )
        result = await db.execute(stmt)
        hits = []
        for row in result.fetchall():
            chunk = row[0]
            distance = row[1]
            score = 1.0 - distance if distance is not None else 0.0
            
            # Similarity threshold filtering (>= 0.35)
            if score >= 0.35:
                hits.append(SearchResult(
                    file_path=chunk.file_path,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    score=round(score, 4),
                    content=chunk.content,
                    searcher_type="semantic"
                ))
        return hits


class TextSearcher(Searcher):
    """Pragmatic M6 Text Search using SQL case-insensitive LIKE matches on chunk content.
    
    Can be seamlessly replaced in later milestones with PostgreSQL full-text search,
    trigram indexes, or ripgrep runners.
    """
    async def search(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        query: str,
        limit: int = 5
    ) -> List[SearchResult]:
        stmt = (
            select(CodeChunk)
            .where(CodeChunk.repository_id == repo_id)
            .where(CodeChunk.content.ilike(f"%{query}%"))
            .order_by(CodeChunk.file_path, CodeChunk.chunk_index)
            .limit(limit)
        )
        result = await db.execute(stmt)
        chunks = result.scalars().all()
        
        return [
            SearchResult(
                file_path=c.file_path,
                start_line=c.start_line,
                end_line=c.end_line,
                score=1.0,  # Exact substring match has confidence score of 1.0
                content=c.content,
                searcher_type="text"
            )
            for c in chunks
        ]


class FileSearcher(Searcher):
    async def search(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        query: str,
        limit: int = 5
    ) -> List[SearchResult]:
        # Search file paths matching the query inside CodeChunk to discover source files
        stmt = (
            select(CodeChunk)
            .where(CodeChunk.repository_id == repo_id)
            .where(CodeChunk.file_path.ilike(f"%{query}%"))
            .where(CodeChunk.chunk_index == 0)  # Get the header/start chunk of matching files
            .order_by(CodeChunk.file_path)
            .limit(limit)
        )
        result = await db.execute(stmt)
        chunks = result.scalars().all()
        
        return [
            SearchResult(
                file_path=c.file_path,
                start_line=c.start_line,
                end_line=c.end_line,
                score=1.0,
                content=c.content[:200] + "\n... (remaining file contents truncated)",
                searcher_type="file"
            )
            for c in chunks
        ]


class SnapshotSearcher(Searcher):
    async def search(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        query: str,
        limit: int = 1
    ) -> List[SearchResult]:
        stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.repository_id == repo_id)
            .where(RepositoryAnalysis.analysis_status == "success")
            .order_by(RepositoryAnalysis.analysis_version.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            return []
            
        content_lines = [
            f"Repository Executive Summary: {analysis.executive_summary or ''}",
            f"Architecture Summary: {analysis.architecture_summary or ''}",
            f"Architecture Style: {analysis.architecture_style or ''}",
            f"Architecture Layers: {', '.join(analysis.architecture_layers or [])}",
            f"Tech Stack: {analysis.tech_stack or {}}"
        ]
        
        return [
            SearchResult(
                file_path="Repository Intelligence Snapshot",
                start_line=1,
                end_line=len(content_lines),
                score=1.0,
                content="\n".join(content_lines),
                searcher_type="snapshot"
            )
        ]
