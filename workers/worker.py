"""ARQ worker for RepoLens background jobs.

Started with: arq workers.worker.WorkerSettings

Pipeline: clone → extract metadata → chunk → embed → store
"""
import asyncio
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from urllib.parse import urlparse

import structlog
from arq.connections import RedisSettings
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import CodeChunk, Repository, get_async_session_factory

from workers.chunk_service import chunk_repository
from workers.embed_service import embed_texts

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = structlog.get_logger()

CLONE_TIMEOUT_SECONDS = 30
MAX_TREE_DEPTH = 10
MAX_CHUNKS_PER_REPO = 5000
SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    ".next", "dist", "build", ".tox", ".mypy_cache",
    ".ruff_cache", ".pytest_cache",
}

EXTENSION_MAP: dict[str, str] = {
    ".py": "Python", ".js": "JavaScript", ".mjs": "JavaScript",
    ".cjs": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript",
    ".jsx": "JavaScript", ".go": "Go", ".rs": "Rust", ".java": "Java",
    ".c": "C", ".h": "C", ".cpp": "C++", ".hpp": "C++", ".cc": "C++",
    ".cs": "C#", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".scala": "Scala", ".sh": "Shell", ".bash": "Shell",
    ".sql": "SQL", ".html": "HTML", ".css": "CSS", ".scss": "CSS",
    ".sass": "CSS", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
    ".toml": "TOML", ".xml": "XML", ".md": "Markdown", ".txt": "Text",
    ".vue": "Vue", ".svelte": "Svelte", ".dockerfile": "Docker",
    ".env": "Config", ".cfg": "Config", ".ini": "Config",
}


async def _run_git_clone(url: str, dest: str) -> str:
    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", url, dest,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await asyncio.wait_for(proc.wait(), timeout=CLONE_TIMEOUT_SECONDS)
    if proc.returncode != 0:
        stderr = (await proc.stderr.read()).decode(errors="replace").strip()
        raise RuntimeError(f"git clone failed: {stderr}")

    branch_proc = await asyncio.create_subprocess_exec(
        "git", "-C", dest, "symbolic-ref", "--short", "HEAD",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await branch_proc.wait()
    branch = "main"
    if branch_proc.returncode == 0:
        branch = (await branch_proc.stdout.read()).decode().strip()
    return branch


def _build_tree(path: Path, depth: int = 0) -> dict:
    name = path.name or "root"
    if depth >= MAX_TREE_DEPTH:
        return {"name": name, "type": "dir", "truncated": True, "children": []}

    children: list[dict] = []
    for child in sorted(path.iterdir(), key=lambda c: (c.is_file(), c.name.lower())):
        if child.is_dir():
            if child.name in SKIP_DIRS:
                continue
            children.append(_build_tree(child, depth + 1))
        else:
            children.append({
                "name": child.name,
                "type": "file",
                "size": child.stat().st_size,
            })

    return {"name": name, "type": "dir", "children": children}


def _extract_metadata(repo_dir: Path) -> dict:
    file_count = 0
    total_size = 0
    languages: dict[str, dict[str, int]] = {}
    file_tree = _build_tree(repo_dir)

    for child in repo_dir.rglob("*"):
        if child.is_file() and not any(part in SKIP_DIRS for part in child.parts):
            file_count += 1
            size = child.stat().st_size
            total_size += size
            ext = child.suffix.lower()
            lang = EXTENSION_MAP.get(ext)
            if not lang and child.name.lower() == "dockerfile":
                lang = "Docker"
            if lang:
                if lang not in languages:
                    languages[lang] = {"files": 0, "bytes": 0}
                languages[lang]["files"] += 1
                languages[lang]["bytes"] += size

    return {
        "file_count": file_count,
        "total_size_bytes": total_size,
        "languages": languages,
        "file_tree": file_tree,
    }


async def _chunk_and_embed(
    repo_dir: Path,
    repository_id: uuid.UUID,
    session: AsyncSession,
) -> int:
    """Chunk repo files, generate embeddings, and store in DB. Returns chunk count."""
    chunks = chunk_repository(repo_dir)
    if len(chunks) > MAX_CHUNKS_PER_REPO:
        chunks = chunks[:MAX_CHUNKS_PER_REPO]
        logger.warning("chunk_limit_reached", repository_id=str(repository_id), limit=MAX_CHUNKS_PER_REPO)

    if not chunks:
        return 0

    texts = [c["content"] for c in chunks]
    logger.info("embedding_start", repository_id=str(repository_id), chunk_count=len(texts))
    embeddings = await asyncio.to_thread(embed_texts, texts)
    logger.info("embedding_done", repository_id=str(repository_id), count=len(embeddings))

    for chunk_data, embedding in zip(chunks, embeddings, strict=False):
        db_chunk = CodeChunk(
            repository_id=repository_id,
            file_path=chunk_data["file_path"],
            language=chunk_data["language"],
            start_line=chunk_data["start_line"],
            end_line=chunk_data["end_line"],
            content=chunk_data["content"],
            chunk_index=chunk_data["chunk_index"],
            embedding=embedding,
        )
        session.add(db_chunk)

    await session.commit()
    return len(chunks)


async def clone_repository(
    ctx: dict,
    repository_id: str,
) -> None:
    """Clone a repository, extract metadata, chunk, and embed.

    Progress phases:
       0  - queued
      10  - cloning started
      40  - clone complete, extracting metadata
      60  - metadata done, chunking + embedding
      90  - embeddings stored
      100 - done
    """
    logger.info("job_started", job="clone_repository", repository_id=repository_id)

    session_factory = get_async_session_factory()
    repo_dir: str | None = None

    async with session_factory() as session:
        result = await session.execute(
            select(Repository).where(Repository.id == repository_id)
        )
        repo = result.scalar_one_or_none()
        if repo is None:
            logger.error("repository_not_found", repository_id=repository_id)
            return

        try:
            # Phase 1: Clone
            repo.status = "cloning"
            repo.progress = 10
            await session.commit()

            repo_dir = tempfile.mkdtemp(prefix="repolens_clone_")
            shutil.rmtree(repo_dir)

            branch = await _run_git_clone(repo.url, repo_dir)

            # Phase 2: Extract metadata
            repo.progress = 40
            await session.commit()

            metadata = _extract_metadata(Path(repo_dir))

            repo.default_branch = branch
            repo.file_count = metadata["file_count"]
            repo.total_size_bytes = metadata["total_size_bytes"]
            repo.languages = metadata["languages"]
            repo.file_tree = metadata["file_tree"]
            repo.progress = 60
            await session.commit()

            # Phase 3: Chunk + Embed
            chunk_count = await _chunk_and_embed(
                Path(repo_dir), repo.id, session
            )

            repo.progress = 90
            await session.commit()

            logger.info(
                "job_complete",
                repository_id=repository_id,
                file_count=metadata["file_count"],
                chunk_count=chunk_count,
            )

            # Phase 4: Done
            repo.status = "ready"
            repo.progress = 100
            repo.error_message = None
            await session.commit()

        except Exception as exc:
            logger.error("job_failed", repository_id=repository_id, error=str(exc))
            repo.status = "failed"
            repo.error_message = str(exc)[:2048]
            await session.commit()
        finally:
            if repo_dir:
                shutil.rmtree(repo_dir, ignore_errors=True)


def get_redis_settings() -> RedisSettings:
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        raise RuntimeError("REDIS_URL environment variable is not set")
    parsed = urlparse(redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password or None,
        ssl=parsed.scheme == "rediss",
        ssl_cert_reqs=None,
    )


async def on_startup(ctx: dict) -> None:
    logger.info("worker_started")


async def on_shutdown(ctx: dict) -> None:
    logger.info("worker_stopped")


class WorkerSettings:
    functions = [clone_repository]
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = get_redis_settings()