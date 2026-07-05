import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.search import (
    RATE_LIMIT,
    SearchHitOut,
    SearchQuery,
    LLMSearchExplanation,
    SearchExplanationOut,
    ChunkExplanationOut,
)
from app.services import project_service, search_service
from app.settings import get_settings
from repolens_db import Repository, RepositoryAnalysis, User

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


@router.post(
    "/projects/{project_id}/search/explain",
    response_model=SearchExplanationOut,
)
@limiter.limit(RATE_LIMIT)
async def explain_project_search(
    request: Request,
    project_id: uuid.UUID,
    body: SearchQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    import os
    from openai import OpenAI

    project = await project_service.get_owned_project_or_404(db, project_id, current_user)
    embedding = await _get_query_embedding(body.query)
    hits = await search_service.search_code(db, project.id, embedding, body.limit)

    if not hits:
        return SearchExplanationOut(
            architectural_context="Unknown",
            quick_understanding="No matching code found in the repository.",
            explanations=[],
            related_files=[]
        )

    # Get latest successful analysis for architectural context
    repo_stmt = select(Repository).where(Repository.project_id == project.id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    analysis_stmt = (
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.repository_id == repo.id)
        .where(RepositoryAnalysis.analysis_status == "success")
        .order_by(RepositoryAnalysis.analysis_version.desc())
        .limit(1)
    )
    analysis_res = await db.execute(analysis_stmt)
    analysis = analysis_res.scalar_one_or_none()

    architecture_summary = analysis.architecture_summary if analysis else "No architectural summary available."
    tech_stack = getattr(analysis, "tech_stack", {}) if analysis else {}

    # Format the chunks for the LLM
    formatted_chunks = []
    for idx, hit in enumerate(hits):
        formatted_chunks.append(
            f"--- CODE CHUNK INDEX {idx} ---\n"
            f"File Path: {hit.file_path}\n"
            f"Language: {hit.language}\n"
            f"Lines: L{hit.start_line}-L{hit.end_line}\n"
            f"Code Snippet:\n{hit.content}\n"
        )
    chunks_context = "\n".join(formatted_chunks)

    system_prompt = (
        "You are an expert principal software engineer analyzing search results for a repository. "
        "Your goal is to explain how the queried feature is implemented, what it does, how it works, and how it fits into the overall architecture.\n\n"
        "Use the repository's architectural summary for context:\n"
        f"{architecture_summary}\n\n"
        f"Tech Stack context: {tech_stack}"
    )

    user_prompt = (
        f"Query: {body.query}\n\n"
        "Here are the semantically matched code chunks from the repository:\n"
        f"{chunks_context}\n\n"
        "Explain these chunks. In the 'explanations' list, map each explanation back to the chunk by its index. "
        "Provide line-specific highlight ranges (highlight_start_line and highlight_end_line) matching the most crucial parts of the code snippet. "
        "Categorize the chunk's role ('entry_point', 'main_implementation', 'supporting_utility', 'configuration', or 'tests')."
    )

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    openai_client = OpenAI(api_key=api_key)

    completion = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format=LLMSearchExplanation,
        temperature=0.2,
        timeout=60.0
    )

    parsed_result = completion.choices[0].message.parsed
    if not parsed_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse AI search explanation.",
        )

    explanations_out = []
    for exp in parsed_result.explanations:
        if 0 <= exp.index < len(hits):
            hit = hits[exp.index]
            # Clamp highlight lines to the actual range of the chunk
            h_start = max(hit.start_line, min(hit.end_line, exp.highlight_start_line))
            h_end = max(h_start, min(hit.end_line, exp.highlight_end_line))

            explanations_out.append(
                ChunkExplanationOut(
                    id=hit.id,
                    file_path=hit.file_path,
                    language=hit.language,
                    start_line=hit.start_line,
                    end_line=hit.end_line,
                    content=hit.content,
                    chunk_index=hit.chunk_index,
                    score=hit.score,
                    symbol_name=exp.symbol_name,
                    highlight_start_line=h_start,
                    highlight_end_line=h_end,
                    role=exp.role,
                    relevance_reason=exp.relevance_reason,
                    explanation=exp.explanation
                )
            )

    return SearchExplanationOut(
        architectural_context=parsed_result.architectural_context,
        quick_understanding=parsed_result.quick_understanding,
        execution_flow=parsed_result.execution_flow,
        explanations=explanations_out,
        related_files=parsed_result.related_files
    )