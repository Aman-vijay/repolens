import time
import json
import os
from datetime import datetime
from pydantic import BaseModel, Field
from openai import OpenAI
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from repolens_db import Repository, RepositoryFile, RepositoryAnalysis

from workers.snapshot_service import build_snapshot, compute_snapshot_hash
from workers.deterministic_extractor import extract_facts
from prompts import build_intelligence_prompt

# Pydantic schemas for OpenAI Structured Outputs
class TechStack(BaseModel):
    languages: list[str] = Field(description="Languages used in the repo")
    frameworks: list[str] = Field(description="Web/app frameworks detected")
    tools: list[str] = Field(description="Build tools, databases, container engines, or utilities detected")

class RepoFacts(BaseModel):
    primary_language: str | None = Field(description="Primary language")
    repository_type: str = Field(description="E.g. application, library, CLI, boilerplate")
    primary_framework: str = Field(description="Primary framework used")
    package_manager: str = Field(description="Package manager used")
    containerized: bool = Field(description="True if Docker/compose files are present")
    ci_detected: bool = Field(description="True if GitHub workflows or other CI files are present")
    license: str = Field(description="SPDX license or description")
    documentation_quality: str = Field(description="E.g. excellent, average, poor")

class RepoInsights(BaseModel):
    strengths: list[str] = Field(description="2-3 technical design strengths")
    risks: list[str] = Field(description="2-3 potential risks or tech debt items")
    notable_decisions: list[str] = Field(description="2-3 interesting or non-obvious engineering decisions")
    patterns_detected: list[str] = Field(description="2-3 design patterns detected")

class LLMAnalysisOutput(BaseModel):
    executive_summary: str = Field(description="2-3 sentence overview")
    architecture_summary: str = Field(description="Detailed overview of architecture")
    architecture_style: str = Field(description="Classified architecture style (e.g. monolith, layered, MVC)")
    architecture_layers: list[str] = Field(description="Distinct tiers/layers present")
    tech_stack: TechStack
    repo_facts: RepoFacts
    repo_insights: RepoInsights


async def run_repository_analysis(
    session: AsyncSession,
    repository_id: str,
    force: bool = False
) -> None:
    """Orchestrates the repository intelligence generation pipeline.
    
    1. Collect Context -> RepositorySnapshot
    2. Check snapshot_hash against existing analysis (Skip LLM if matched, unless force=True)
    3. Run Deterministic Extraction
    4. Compile Prompts -> LLM Structured call
    5. Merge & Validate (Deterministic facts override LLM facts)
    6. Persist to repository_analyses table
    """
    # Load Repository
    stmt = select(Repository).where(Repository.id == repository_id)
    res = await session.execute(stmt)
    repo = res.scalar_one_or_none()
    if repo is None:
        raise ValueError(f"Repository {repository_id} not found")

    # Load RepositoryFiles
    files_stmt = select(RepositoryFile).where(RepositoryFile.repository_id == repo.id)
    files_res = await session.execute(files_stmt)
    db_files = list(files_res.scalars().all())

    # 1. Build Snapshot & Hash
    t0 = time.perf_counter()
    snapshot = await build_snapshot(session, repo)
    snap_hash = compute_snapshot_hash(snapshot)
    t_snapshot = int((time.perf_counter() - t0) * 1000)

    # 2. Check for existing successful analysis with the same hash
    if not force:
        existing_stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.repository_id == repo.id)
            .where(RepositoryAnalysis.analysis_status == "success")
            .where(RepositoryAnalysis.snapshot_hash == snap_hash)
            .order_by(RepositoryAnalysis.analysis_version.desc())
            .limit(1)
        )
        existing_res = await session.execute(existing_stmt)
        existing_analysis = existing_res.scalar_one_or_none()
        if existing_analysis:
            # Hash is unchanged, skip LLM call and return immediately
            return

    # Get next version number
    version_stmt = (
        select(RepositoryAnalysis.analysis_version)
        .where(RepositoryAnalysis.repository_id == repo.id)
        .order_by(RepositoryAnalysis.analysis_version.desc())
        .limit(1)
    )
    v_res = await session.execute(version_stmt)
    last_v = v_res.scalar_one_or_none() or 0
    next_version = last_v + 1

    # Create pending analysis row
    analysis = RepositoryAnalysis(
        repository_id=repo.id,
        analysis_version=next_version,
        analysis_status="pending",
        snapshot_hash=snap_hash,
        model="gpt-4o-mini",
        prompt_version="v1.0.0"
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)

    try:
        analysis.analysis_status = "running"
        await session.commit()

        # 3. Deterministic Extraction
        t0 = time.perf_counter()
        det_facts = extract_facts(db_files, repo)
        t_deterministic = int((time.perf_counter() - t0) * 1000)

        # 4. Prompt Assembly
        t0 = time.perf_counter()
        context = {
            "repo_url": snapshot.repo_url,
            "readme_content": snapshot.readme_content or "No README file found.",
            "manifest_snippets": snapshot.manifest_snippets,
            "file_tree_outline": snapshot.file_tree_outline,
            "language_stats": snapshot.language_stats
        }
        system_prompt, user_prompt = build_intelligence_prompt(context)
        t_prompt = int((time.perf_counter() - t0) * 1000)

        # 5. Call LLM
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        llm_t0 = time.perf_counter()
        
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format=LLMAnalysisOutput,
            temperature=0.1,
            timeout=45.0
        )
        llm_latency = int((time.perf_counter() - llm_t0) * 1000)

        # Get structured output
        result = completion.choices[0].message.parsed
        if not result:
            raise RuntimeError("Failed to parse structured LLM response.")

        # 6. Merge & Validate (Deterministic facts override LLM outputs)
        merged_facts = result.repo_facts.model_dump()
        for key, val in det_facts.items():
            # If deterministic check confirmed the fact with certainty, override the LLM output
            if key == "fact_sources":
                continue
            if det_facts["fact_sources"].get(key):
                merged_facts[key] = val
                
        # Inject merged fact sources
        merged_facts["fact_sources"] = {
            **getattr(result.repo_facts, "fact_sources", {}),
            **det_facts["fact_sources"]
        }

        # Source context
        source_context = {
            "readme_present": bool(snapshot.readme_content),
            "readme_truncated": False,
            "readme_chars": len(snapshot.readme_content) if snapshot.readme_content else 0,
            "manifest_files_found": list(snapshot.manifest_snippets.keys()),
            "top_chunks_used": 0,
            "total_context_chars": len(system_prompt) + len(user_prompt)
        }

        # Internal metrics
        analysis_metrics = {
            "repository_file_count": repo.file_count,
            "repository_size_bytes": repo.total_size_bytes,
            "key_files_read": len(db_files),
            "snapshot_build_ms": t_snapshot,
            "deterministic_extraction_ms": t_deterministic,
            "prompt_assembly_ms": t_prompt
        }

        # Populate the analysis record
        analysis.executive_summary = result.executive_summary
        analysis.architecture_summary = result.architecture_summary
        analysis.architecture_style = result.architecture_style
        analysis.architecture_layers = result.architecture_layers
        analysis.tech_stack = result.tech_stack.model_dump()
        analysis.repo_facts = merged_facts
        analysis.repo_insights = result.repo_insights.model_dump()
        analysis.source_context = source_context
        analysis.analysis_metrics = analysis_metrics
        analysis.token_usage = {
            "prompt_tokens": completion.usage.prompt_tokens if completion.usage else 0,
            "completion_tokens": completion.usage.completion_tokens if completion.usage else 0,
            "total_tokens": completion.usage.total_tokens if completion.usage else 0
        }
        analysis.generation_latency_ms = llm_latency
        analysis.generated_at = datetime.utcnow()
        analysis.analysis_status = "success"
        analysis.error_message = None

        await session.commit()

    except Exception as exc:
        analysis.analysis_status = "failed"
        analysis.error_message = str(exc)
        await session.commit()
        raise exc
