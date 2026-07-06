import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import CodeChunk, RepositoryFile
from app.services.search_engine import SemanticSearcher, TextSearcher, FileSearcher


async def execute_tool(db: AsyncSession, repo_id: uuid.UUID, tool_name: str, args: dict) -> str:
    """Executes a specific searcher tool and returns a structured JSON string."""
    if tool_name == "semantic_search":
        query = args.get("query", "")
        searcher = SemanticSearcher()
        hits = await searcher.search(db, repo_id, query, limit=5)
        # Structured JSON response
        return json.dumps({
            "query": query,
            "hits": [
                {
                    "file_path": h.file_path,
                    "start_line": h.start_line,
                    "end_line": h.end_line,
                    "score": h.score,
                    "content": h.content
                }
                for h in hits
            ]
        })

    elif tool_name == "text_search":
        query = args.get("query", "")
        searcher = TextSearcher()
        hits = await searcher.search(db, repo_id, query, limit=5)
        return json.dumps({
            "query": query,
            "matches": [
                {
                    "file_path": h.file_path,
                    "start_line": h.start_line,
                    "end_line": h.end_line,
                    "content": h.content
                }
                for h in hits
            ]
        })

    elif tool_name == "find_files":
        pattern = args.get("pattern", "")
        searcher = FileSearcher()
        hits = await searcher.search(db, repo_id, pattern, limit=5)
        return json.dumps({
            "pattern": pattern,
            "files": [
                {
                    "file_path": h.file_path,
                    "preview": h.content
                }
                for h in hits
            ]
        })

    elif tool_name == "view_file_content":
        file_path = args.get("file_path", "")
        
        # 1. First look up the database repository_files (key files)
        file_stmt = (
            select(RepositoryFile)
            .where(RepositoryFile.repository_id == repo_id)
            .where(RepositoryFile.file_path == file_path)
        )
        file_res = await db.execute(file_stmt)
        repo_file = file_res.scalar_one_or_none()
        if repo_file:
            return json.dumps({
                "file_path": file_path,
                "content": repo_file.content,
                "truncated": False
            })

        # 2. Reconstruct source file from CodeChunks if not a metadata file
        chunks_stmt = (
            select(CodeChunk)
            .where(CodeChunk.repository_id == repo_id)
            .where(CodeChunk.file_path == file_path)
            .order_by(CodeChunk.chunk_index.asc())
        )
        chunks_res = await db.execute(chunks_stmt)
        chunks = chunks_res.scalars().all()
        if not chunks:
            return json.dumps({"error": f"File {file_path} not found in database index."})

        # Join the contents
        reconstructed = "\n".join([c.content for c in chunks])
        # Cap reconstructed content at 100KB to stay within prompt budgets
        is_truncated = len(reconstructed) > 100_000
        if is_truncated:
            reconstructed = reconstructed[:100_000] + "\n... [content truncated due to file size]"
            
        return json.dumps({
            "file_path": file_path,
            "content": reconstructed,
            "truncated": is_truncated
        })

    return json.dumps({"error": f"Unknown tool: {tool_name}"})
