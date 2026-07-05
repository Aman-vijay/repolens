import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.search import RATE_LIMIT, SearchHitOut, SearchQuery
from app.services import project_service, search_service
from app.settings import get_settings
from repolens_db import User

router = APIRouter(tags=["search"])

OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"


async def _get_query_embedding(query: str) -> list[float]:
    import os

    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            OPENAI_EMBED_URL,
            json={"model": "text-embedding-3-small", "input": query},
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        resp.raise_for_status()

    return resp.json()["data"][0]["embedding"]


@router.post(
    "/projects/{project_id}/search",
    response_model=list[SearchHitOut],
)
@limiter.limit(RATE_LIMIT)
async def search_project_code(
    request: Request,
    project_id: uuid.UUID,
    body: SearchQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    embedding = await _get_query_embedding(body.query)
    return await search_service.search_code(db, project.id, embedding, body.limit)