import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from repolens_db import RepositoryFile

KEY_FILES = {
    "readme.md", "readme.rst",
    "package.json", "pyproject.toml", "cargo.toml", "go.mod",
    "dockerfile", "docker-compose.yml",
    "license", "license.md", "copying"
}

def is_key_file(path: Path, relative_path: Path) -> bool:
    name_lower = path.name.lower()
    if name_lower in KEY_FILES:
        return True
    # Capture CI workflows
    parts_lower = [p.lower() for p in relative_path.parts]
    if ".github" in parts_lower and "workflows" in parts_lower:
        if name_lower.endswith(".yml") or name_lower.endswith(".yaml"):
            return True
    return False

async def save_key_files(repo_dir: Path, repository_id: str, session: AsyncSession) -> None:
    saved_count = 0
    max_files = 20
    max_size_bytes = 32768  # 32KB
    
    for root, dirs, files in os.walk(repo_dir):
        # Skip standard noisy directories
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist", "build"}]
        
        for fname in files:
            if saved_count >= max_files:
                break
                
            fpath = Path(root) / fname
            relative = fpath.relative_to(repo_dir)
            
            if is_key_file(fpath, relative):
                try:
                    size = fpath.stat().st_size
                    # Skip files that are unexpectedly huge before loading to memory
                    if size > 1_000_000:
                        continue
                        
                    content = fpath.read_text(encoding="utf-8", errors="replace")
                    if len(content) > max_size_bytes:
                        content = content[:max_size_bytes]
                        
                    db_file = RepositoryFile(
                        repository_id=repository_id,
                        file_path=str(relative).replace("\\", "/"),
                        content=content,
                        size_bytes=size
                    )
                    session.add(db_file)
                    saved_count += 1
                except Exception:
                    pass
                    
    await session.commit()
