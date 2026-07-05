import hashlib
import json
from dataclasses import dataclass, asdict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from repolens_db import Repository, RepositoryFile

@dataclass
class RepositorySnapshot:
    repo_url: str
    readme_content: str | None
    manifest_snippets: dict[str, str]
    file_tree_outline: str
    language_stats: dict

def format_file_tree(node: dict, indent: int = 0) -> str:
    """Recursively formats a JSON file tree node into indented text."""
    name = node.get("name", "root")
    node_type = node.get("type", "dir")
    
    line = "  " * indent + f"- {name}/" if node_type == "dir" else "  " * indent + f"- {name}"
    lines = [line]
    
    if node_type == "dir" and "children" in node:
        # Limit depth in outline to keep token count low
        if indent < 4:
            for child in node["children"]:
                lines.append(format_file_tree(child, indent + 1))
        else:
            lines.append("  " * (indent + 1) + "... (nested files truncated)")
            
    return "\n".join(lines)

async def build_snapshot(session: AsyncSession, repo: Repository) -> RepositorySnapshot:
    # 1. Fetch all repository files stored during the clone phase
    stmt = select(RepositoryFile).where(RepositoryFile.repository_id == repo.id)
    res = await session.execute(stmt)
    db_files = res.scalars().all()
    
    readme_content = None
    manifest_snippets = {}
    
    # 2. Extract README and manifest contents
    for f in db_files:
        path_lower = f.file_path.lower()
        if "readme.md" in path_lower or "readme.rst" in path_lower:
            readme_content = f.content
        elif f.file_path in {"package.json", "pyproject.toml", "cargo.toml", "go.mod", "docker-compose.yml", "Dockerfile"}:
            manifest_snippets[f.file_path] = f.content[:1500]  # Cap snippet length
            
    # 3. Format file tree
    tree_outline = ""
    if repo.file_tree:
        try:
            tree_outline = format_file_tree(repo.file_tree)
        except Exception:
            tree_outline = "Failed to parse file tree."
            
    return RepositorySnapshot(
        repo_url=repo.url,
        readme_content=readme_content,
        manifest_snippets=manifest_snippets,
        file_tree_outline=tree_outline,
        language_stats=repo.languages or {}
    )

def compute_snapshot_hash(snapshot: RepositorySnapshot) -> str:
    """Computes a SHA-256 hash of the snapshot to detect modifications."""
    serialized = json.dumps(asdict(snapshot), sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
