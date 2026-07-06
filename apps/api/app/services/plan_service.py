import asyncio
import json
import os
import time
import uuid
from typing import Optional, List, Dict, Any

from openai import AsyncOpenAI
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import (
    Project,
    Repository,
    RepositoryAnalysis,
    PlanSession,
    PlanVersion,
    get_async_session_factory,
)
from app.services.search_engine import SemanticSearcher


async def create_plan_session(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    feature_request: str,
) -> PlanSession:
    """Creates a new plan session and queues version 1 generation."""
    title = feature_request[:45] + "..." if len(feature_request) > 45 else feature_request
    session = PlanSession(
        project_id=project_id,
        user_id=user_id,
        title=title,
        feature_request=feature_request,
    )
    db.add(session)
    await db.flush()

    # Create initial version
    version = PlanVersion(
        session_id=session.id,
        version=1,
        status="pending",
        model="gpt-4o-mini",
    )
    db.add(version)
    await db.commit()
    await db.refresh(session)

    # Start generation task in the background
    asyncio.create_task(_generate_plan_background(version.id))

    return session


async def refine_plan(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    refinement_prompt: str,
) -> PlanVersion:
    """Creates a new plan version based on a refinement prompt and queues generation."""
    stmt = (
        select(PlanSession)
        .where(PlanSession.id == session_id)
        .where(PlanSession.user_id == user_id)
        .options(selectinload(PlanSession.versions))
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Plan session not found")

    next_version_num = len(session.versions) + 1

    version = PlanVersion(
        session_id=session_id,
        version=next_version_num,
        refinement_prompt=refinement_prompt,
        status="pending",
        model="gpt-4o-mini",
    )
    db.add(version)
    await db.commit()

    # Start generation in the background
    asyncio.create_task(_generate_plan_background(version.id))

    return version


async def list_plan_sessions(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> List[PlanSession]:
    """Lists all plan sessions for a project."""
    stmt = (
        select(PlanSession)
        .where(PlanSession.project_id == project_id)
        .where(PlanSession.user_id == user_id)
        .order_by(PlanSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_plan_session_detail(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> PlanSession:
    """Gets a specific plan session with all versions."""
    stmt = (
        select(PlanSession)
        .where(PlanSession.id == session_id)
        .where(PlanSession.project_id == project_id)
        .where(PlanSession.user_id == user_id)
        .options(selectinload(PlanSession.versions))
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Plan session not found")
    return session


async def delete_plan_session(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> bool:
    """Deletes a plan session."""
    stmt = (
        select(PlanSession)
        .where(PlanSession.id == session_id)
        .where(PlanSession.project_id == project_id)
        .where(PlanSession.user_id == user_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True


async def _generate_plan_background(version_id: uuid.UUID):
    session_factory = get_async_session_factory()
    async with session_factory() as db:
        await generate_plan(db, version_id)


async def generate_plan(db: AsyncSession, version_id: uuid.UUID):
    """Executes the AI planning pipeline, querying repository context and generating structured JSON."""
    stmt = (
        select(PlanVersion)
        .where(PlanVersion.id == version_id)
        .options(selectinload(PlanVersion.session))
    )
    res = await db.execute(stmt)
    version = res.scalar_one_or_none()
    if not version:
        return

    # Update status to generating
    version.status = "generating"
    await db.commit()

    try:
        session = version.session
        feature_request = session.feature_request

        # Fetch Repository
        repo_stmt = select(Repository).where(Repository.project_id == session.project_id)
        repo_res = await db.execute(repo_stmt)
        repo = repo_res.scalar_one_or_none()
        if not repo:
            raise ValueError("No repository attached to this project")

        # Fetch Analysis
        analysis_stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.repository_id == repo.id)
            .where(RepositoryAnalysis.analysis_status == "success")
            .order_by(RepositoryAnalysis.analysis_version.desc())
            .limit(1)
        )
        analysis_res = await db.execute(analysis_stmt)
        analysis = analysis_res.scalar_one_or_none()

        # Semantic search for codebase context
        searcher = SemanticSearcher()
        search_query = feature_request
        if version.version > 1 and version.refinement_prompt:
            search_query = f"{feature_request}\n{version.refinement_prompt}"
        
        hits = await searcher.search(db, repo.id, search_query, limit=8)

        # Build context
        analysis_summary = ""
        tech_stack_info = ""
        architecture_info = ""
        if analysis:
            analysis_summary = analysis.executive_summary or ""
            if analysis.tech_stack:
                tech_stack_info = json.dumps(analysis.tech_stack, indent=2)
            if analysis.architecture_summary:
                architecture_info = f"Summary: {analysis.architecture_summary}\nStyle: {analysis.architecture_style or ''}"

        file_tree_str = ""
        if repo.file_tree:
            file_tree_str = json.dumps(repo.file_tree, indent=2)

        code_chunks_str = ""
        for i, hit in enumerate(hits):
            code_chunks_str += f"\n--- Match {i+1}: {hit.file_path} (Lines {hit.start_line}-{hit.end_line}) ---\n"
            code_chunks_str += hit.content

        # Configure system prompt matching the approved design
        system_prompt = (
            "You are a Staff Software Engineer performing implementation planning for an existing production codebase.\n\n"
            "Your objective is not to invent new architecture.\n\n"
            "Your objective is to understand the existing repository, identify established implementation patterns, "
            "and produce an implementation plan that integrates naturally with the current design.\n\n"
            "Before suggesting changes:\n"
            "- Identify existing patterns that solve similar problems.\n"
            "- Reuse those patterns whenever possible.\n"
            "- Minimize architectural churn.\n"
            "- Clearly separate confirmed facts from assumptions.\n"
            "- If repository evidence is insufficient, explicitly state what additional investigation is required instead of guessing.\n"
            "- Prefer incremental, reviewable changes over large rewrites.\n\n"
            "The resulting plan should read like a technical design document prepared by a senior engineer for another engineer to implement.\n\n"
            "CONSTRAINTS:\n"
            "- NEVER output code blocks, code snippets, or implementation code.\n"
            "- NEVER invent APIs, config options, or flags that don't exist in the codebase.\n"
            "- Output ONLY a raw JSON object complying with the schema below.\n"
            "- If unsure about a file or pattern, set confidence to 'medium' or 'low' and explain in unknowns.\n\n"
            "JSON SCHEMA:\n"
            "{\n"
            '  "summary": "High-level description of what this plan achieves",\n'
            '  "estimated_complexity": "low | medium | high",\n'
            '  "confidence": "high | medium | low",\n'
            '  "confidence_reason": "Explanation of the confidence level",\n'
            '  "affected_areas": ["database", "api", "frontend", etc],\n'
            '  "architecture_impact": {\n'
            '    "layers": ["Database", "API", "Frontend", etc],\n'
            '    "breaking_change": false\n'
            '  },\n'
            '  "existing_patterns": [\n'
            '    {\n'
            '      "description": "description of the pattern",\n'
            '      "files": ["file_path_1", "file_path_2"]\n'
            '    }\n'
            '  ],\n'
            '  "planning_checklist": ["pre-implementation verification check 1", "check 2"],\n'
            '  "prerequisites": ["prerequisite step 1"],\n'
            '  "steps": [\n'
            '    {\n'
            '      "order": 1,\n'
            '      "title": "step title",\n'
            '      "description": "step description with rich reasoning",\n'
            '      "why_this_order": "why does this step come first or after dependencies?",\n'
            '      "migration_impact": "impact on DB schema or state (or None)",\n'
            '      "rollback_concern": "how to revert this step if it fails",\n'
            '      "files": [\n'
            '        {\n'
            '          "path": "file_path_to_change",\n'
            '          "action": "modify | new | delete",\n'
            '          "reason": "why are we changing this file",\n'
            '          "confidence": "high | medium | low"\n'
            '        }\n'
            '      ],\n'
            '      "references": [\n'
            '        {\n'
            '          "path": "existing_file_to_follow_as_pattern",\n'
            '          "reason": "how this file serves as a reference pattern"\n'
            '        }\n'
            '      ],\n'
            '      "depends_on": [],\n'
            '      "risks": ["risk 1", "risk 2"]\n'
            '    }\n'
            '  ],\n'
            '  "why_this_order": ["general ordering reason 1", "reason 2"],\n'
            '  "risks_and_considerations": ["general risk 1"],\n'
            '  "unknowns": ["explicit missing info or uncertainty 1"],\n'
            '  "testing_suggestions": ["how to verify this change"]\n'
            "}"
        )

        user_content = "Repository Context:\n"
        if analysis_summary:
            user_content += f"- Executive Summary: {analysis_summary}\n"
        if architecture_info:
            user_content += f"- Architecture: {architecture_info}\n"
        if tech_stack_info:
            user_content += f"- Tech Stack:\n{tech_stack_info}\n"
        if file_tree_str:
            user_content += f"- File Tree:\n{file_tree_str}\n"
        if code_chunks_str:
            user_content += f"- Relevant Code Chunks:\n{code_chunks_str}\n"

        user_content += f"\n\nFeature Request to plan: {feature_request}\n"

        messages = [
            {"role": "system", "content": system_prompt}
        ]

        if version.version > 1:
            # Find the previous version plan
            prev_stmt = (
                select(PlanVersion)
                .where(PlanVersion.session_id == session.id)
                .where(PlanVersion.version == version.version - 1)
            )
            prev_res = await db.execute(prev_stmt)
            prev_version = prev_res.scalar_one_or_none()
            if prev_version and prev_version.plan_content:
                prev_plan_json = json.dumps(prev_version.plan_content, indent=2)
                refinement_instruction = (
                    f"Here is the previous implementation plan:\n{prev_plan_json}\n\n"
                    f"The user wants to refine/adjust this plan with the following instruction:\n"
                    f"\"{version.refinement_prompt}\"\n\n"
                    f"Please update the plan JSON based on this instruction, maintaining consistency with repository patterns."
                )
                messages.append({"role": "user", "content": user_content})
                messages.append({"role": "user", "content": refinement_instruction})
            else:
                messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": user_content})

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured")

        client = AsyncOpenAI(api_key=api_key)
        start_time = time.time()
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        
        latency = int((time.time() - start_time) * 1000)
        content_text = response.choices[0].message.content or ""
        plan_json = json.loads(content_text)

        version.plan_content = plan_json
        version.status = "completed"
        version.generation_latency_ms = latency
        version.token_usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
        
        # Touch session updated_at
        session.updated_at = sa.func.now()

    except Exception as e:
        version.status = "failed"
        version.error_message = str(e)
    
    await db.commit()
