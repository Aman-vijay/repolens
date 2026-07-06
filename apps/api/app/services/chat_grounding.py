import json
import uuid
from typing import Any, List, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import (
    CodeChunk,
    RepositoryAnalysis,
    RepositoryFile,
)
from app.services.search_engine import (
    SemanticSearcher,
    FileSearcher,
    SearchResult
)

ARCHITECTURE_KEYWORDS = (
    "architecture",
    "routing",
    "router",
    "layout",
    "page",
    "pages",
    "flow",
    "structure",
    "entry point",
    "entrypoint",
    "how does",
    "how is",
)

PATTERN_KEYWORDS = (
    "pattern",
    "patterns",
    "design pattern",
    "design patterns",
    "state management",
    "component structure",
    "folder structure",
    "how is this organized",
)

ENTRYPOINT_CANDIDATES = (
    "README.md",
    "package.json",
    "app/layout.tsx",
    "app/page.tsx",
    "app/api/chat/route.ts",
    "components/chat/ChatUi.tsx",
    "components/chat/MessageList.tsx",
    "components/chat/ChatHeader.tsx",
)


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, default=str)


def _format_analysis_context(analysis: RepositoryAnalysis | None) -> str:
    if not analysis:
        return ""

    sections = [
        "REPOSITORY INTELLIGENCE:",
        f"- Executive Summary: {analysis.executive_summary or ''}",
        f"- Architecture Summary: {analysis.architecture_summary or ''}",
        f"- Architecture Style: {analysis.architecture_style or ''}",
        f"- Architecture Layers: {', '.join(analysis.architecture_layers or [])}",
        f"- Tech Stack: {_json_dump(analysis.tech_stack or {})}",
    ]

    if analysis.repo_facts:
        sections.append(f"- Repo Facts: {_json_dump(analysis.repo_facts)}")
    if analysis.repo_insights:
        sections.append(f"- Repo Insights: {_json_dump(analysis.repo_insights)}")
    if analysis.source_context:
        sections.append(f"- Source Context: {_json_dump(analysis.source_context)}")

    return "\n".join(sections)


def _format_search_results(title: str, results: List[SearchResult]) -> str:
    if not results:
        return ""

    lines = [title]
    for result in results:
        lines.extend(
            [
                f"File: {result.file_path}",
                f"Lines: L{result.start_line}-L{result.end_line}",
                f"Search Type: {result.searcher_type}",
                f"Score: {result.score}",
                "Snippet:",
                result.content,
                "",
            ]
        )
    return "\n".join(lines).strip()


def _is_architecture_query(query: str) -> bool:
    lowered = query.lower()
    return any(keyword in lowered for keyword in ARCHITECTURE_KEYWORDS)


def _is_pattern_query(query: str) -> bool:
    lowered = query.lower()
    return any(keyword in lowered for keyword in PATTERN_KEYWORDS)


def _infer_target_file_patterns(query: str, analysis: RepositoryAnalysis | None) -> List[str]:
    lowered = query.lower()
    patterns: List[str] = []
    tech_stack = _json_dump(getattr(analysis, "tech_stack", {}) or {}).lower()
    repo_facts = _json_dump(getattr(analysis, "repo_facts", {}) or {}).lower()
    repo_context = f"{tech_stack} {repo_facts}"

    if any(token in lowered for token in ("routing", "router", "layout", "page", "app router", "navigation")):
        patterns.extend(["layout.tsx", "page.tsx", "app/", "dashboard"])

    if any(token in lowered for token in ("auth", "login", "sign in", "sign up", "clerk")):
        patterns.extend(["sign-in", "sign-up", "middleware.ts", "clerk", "auth"])

    if any(token in lowered for token in ("api", "endpoint", "route", "backend", "fastapi")):
        patterns.extend(["routes/", "main.py", "api/"])

    if "next" in repo_context:
        patterns.extend(["layout.tsx", "page.tsx", "app/"])
    if "fastapi" in repo_context:
        patterns.extend(["main.py", "routes/"])

    seen = set()
    ordered_patterns: List[str] = []
    for pattern in patterns:
        if pattern not in seen:
            seen.add(pattern)
            ordered_patterns.append(pattern)
    return ordered_patterns


async def _load_key_file_by_exact_path(
    db: AsyncSession,
    repo_id: uuid.UUID,
    file_path: str,
) -> tuple[str, str] | None:
    file_stmt = (
        select(RepositoryFile)
        .where(RepositoryFile.repository_id == repo_id)
        .where(RepositoryFile.file_path == file_path)
    )
    file_res = await db.execute(file_stmt)
    repo_file = file_res.scalar_one_or_none()
    if repo_file and repo_file.content:
        return file_path, repo_file.content

    chunks_stmt = (
        select(CodeChunk)
        .where(CodeChunk.repository_id == repo_id)
        .where(CodeChunk.file_path == file_path)
        .order_by(CodeChunk.chunk_index.asc())
    )
    chunks_res = await db.execute(chunks_stmt)
    chunks = chunks_res.scalars().all()
    if not chunks:
        return None

    return file_path, "\n".join(chunk.content for chunk in chunks)


async def _load_file_content(db: AsyncSession, repo_id: uuid.UUID, file_path: str, max_chars: int = 6000) -> str:
    file_stmt = (
        select(RepositoryFile)
        .where(RepositoryFile.repository_id == repo_id)
        .where(RepositoryFile.file_path == file_path)
    )
    file_res = await db.execute(file_stmt)
    repo_file = file_res.scalar_one_or_none()
    if repo_file and repo_file.content:
        content = repo_file.content
    else:
        chunks_stmt = (
            select(CodeChunk)
            .where(CodeChunk.repository_id == repo_id)
            .where(CodeChunk.file_path == file_path)
            .order_by(CodeChunk.chunk_index.asc())
        )
        chunks_res = await db.execute(chunks_stmt)
        chunks = chunks_res.scalars().all()
        if not chunks:
            return ""
        content = "\n".join(chunk.content for chunk in chunks)

    if len(content) > max_chars:
        return content[:max_chars] + "\n... [file content truncated]"
    return content


async def _build_grounding_context(
    db: AsyncSession,
    repo_id: uuid.UUID,
    user_query: str,
    analysis: RepositoryAnalysis | None,
) -> tuple[str, int, List[str], List[str]]:
    sections: List[str] = []
    trace_messages: List[str] = []
    evidence_count = 0
    grounded_files: List[str] = []

    analysis_context = _format_analysis_context(analysis)
    if analysis_context:
        sections.append(analysis_context)
        evidence_count += 1

    semantic_hits = await SemanticSearcher().search(db, repo_id, user_query, limit=4)
    if semantic_hits:
        sections.append(_format_search_results("SEMANTIC SEARCH HITS:", semantic_hits))
        trace_messages.append(f"Loaded {len(semantic_hits)} semantic code hits.")
        evidence_count += len(semantic_hits)
        for hit in semantic_hits:
            if hit.file_path not in grounded_files:
                grounded_files.append(hit.file_path)
    else:
        trace_messages.append("Semantic search returned no strong code hits.")

    if _is_architecture_query(user_query) or _is_pattern_query(user_query) or not semantic_hits:
        targeted_sections: List[str] = []
        seen_files = set()
        fallback_patterns = _infer_target_file_patterns(user_query, analysis)
        if not fallback_patterns:
            fallback_patterns = ["README", "package.json", "pyproject.toml", "main.py", "app/", "src/"]

        for pattern in fallback_patterns:
            file_hits = await FileSearcher().search(db, repo_id, pattern, limit=3)
            for hit in file_hits:
                if hit.file_path in seen_files:
                    continue
                seen_files.add(hit.file_path)
                file_content = await _load_file_content(db, repo_id, hit.file_path)
                if not file_content:
                    continue
                targeted_sections.append(
                    "\n".join(
                        [
                            f"File: {hit.file_path}",
                            "Content:",
                            file_content,
                        ]
                    )
                )
                evidence_count += 1
                if hit.file_path not in grounded_files:
                    grounded_files.append(hit.file_path)
                if len(targeted_sections) >= 4:
                    break
            if len(targeted_sections) >= 4:
                break

        if targeted_sections:
            sections.append("TARGETED FILE CONTEXT:\n" + "\n\n".join(targeted_sections))
            trace_messages.append(f"Preloaded {len(targeted_sections)} targeted files.")

    if _is_pattern_query(user_query) or evidence_count <= 2:
        entrypoint_sections: List[str] = []
        for candidate in ENTRYPOINT_CANDIDATES:
            loaded = await _load_key_file_by_exact_path(db, repo_id, candidate)
            if not loaded:
                continue

            file_path, content = loaded
            if file_path in grounded_files:
                continue

            entrypoint_sections.append(
                "\n".join(
                    [
                        f"File: {file_path}",
                        "Content:",
                        content[:5000] + ("\n... [file content truncated]" if len(content) > 5000 else ""),
                    ]
                )
            )
            grounded_files.append(file_path)
            evidence_count += 1
            if len(entrypoint_sections) >= 4:
                break

        if entrypoint_sections:
            sections.append("ENTRYPOINT FILE CONTEXT:\n" + "\n\n".join(entrypoint_sections))
            trace_messages.append(f"Loaded {len(entrypoint_sections)} key repository files.")

    return "\n\n".join(section for section in sections if section), evidence_count, trace_messages, grounded_files
