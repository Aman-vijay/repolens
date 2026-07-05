"""Code chunking service — parse cloned repos into semantic chunks using tree-sitter.

For each file in the cloned repo:
  1. Detect language by extension
  2. Parse with tree-sitter
  3. Split into chunks at function/class boundaries
  4. Return chunks with file_path, line numbers, content, language

Chunking strategy:
  - Parse the AST and extract top-level function/class definitions
  - Each definition = one chunk
  - If no tree-sitter grammar for the language, fall back to line-based chunks (N lines per chunk)
  - Max chunk size: ~1500 tokens (roughly 6000 chars) to stay within embedding context
"""
import os
from pathlib import Path

from tree_sitter_languages import get_parser

MAX_CHUNK_CHARS = 6000
FALLBACK_CHUNK_LINES = 60

EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".jsx": "javascript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "c_sharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".sql": "sql",
}

SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    ".next", "dist", "build", ".tox", ".mypy_cache",
    ".ruff_cache", ".pytest_cache",
}

CHUNK_NODE_TYPES = {
    "python": {"function_definition", "class_definition"},
    "javascript": {"function_declaration", "class_declaration", "method_definition", "export_statement"},
    "typescript": {"function_declaration", "class_declaration", "method_definition", "interface_declaration", "type_alias_declaration"},
    "tsx": {"function_declaration", "class_declaration", "method_definition", "interface_declaration", "type_alias_declaration"},
    "go": {"function_declaration", "method_declaration", "type_declaration"},
    "rust": {"function_item", "struct_item", "enum_item", "impl_item"},
    "java": {"method_declaration", "class_declaration", "interface_declaration"},
    "c": {"function_definition"},
    "cpp": {"function_definition", "class_specifier", "struct_specifier"},
    "ruby": {"method", "class", "module"},
}


def detect_language(file_path: Path) -> str | None:
    """Return tree-sitter language name for a file, or None if unsupported."""
    ext = file_path.suffix.lower()
    if file_path.name.lower() == "dockerfile":
        return None
    return EXTENSION_TO_LANGUAGE.get(ext)


def _chunk_with_treesitter(content: bytes, language: str) -> list[dict]:
    """Parse content with tree-sitter and extract top-level definitions as chunks."""
    try:
        parser = get_parser(language)
    except Exception:
        return []

    tree = parser.parse(content)
    root = tree.root_node

    target_types = CHUNK_NODE_TYPES.get(language, set())
    if not target_types:
        return []

    chunks: list[dict] = []
    for child in root.children:
        if child.type in target_types:
            start_line = child.start_byte
            end_byte = child.end_byte
            text = content[start_line:end_byte].decode("utf-8", errors="replace")
            if len(text.strip()) > 0:
                chunks.append({
                    "start_line": child.start_point[0] + 1,
                    "end_line": child.end_point[0] + 1,
                    "content": text,
                })
    return chunks


def _chunk_by_lines(content: str, lines_per_chunk: int = FALLBACK_CHUNK_LINES) -> list[dict]:
    """Fallback: split content into fixed-size line chunks."""
    lines = content.split("\n")
    chunks: list[dict] = []
    for i in range(0, len(lines), lines_per_chunk):
        chunk_lines = lines[i:i + lines_per_chunk]
        text = "\n".join(chunk_lines)
        if text.strip():
            chunks.append({
                "start_line": i + 1,
                "end_line": min(i + lines_per_chunk, len(lines)),
                "content": text,
            })
    return chunks


def chunk_file(repo_dir: Path, relative_path: Path) -> dict | None:
    """Parse a single file into chunks. Returns dict with file_path, language, chunks list."""
    language = detect_language(relative_path)
    if language is None:
        return None

    abs_path = repo_dir / relative_path
    try:
        content_bytes = abs_path.read_bytes()
    except Exception:
        return None

    if len(content_bytes) > 200_000:
        return None

    if language in CHUNK_NODE_TYPES:
        ts_chunks = _chunk_with_treesitter(content_bytes, language)
        if ts_chunks:
            return {
                "file_path": str(relative_path).replace("\\", "/"),
                "language": language,
                "chunks": ts_chunks,
            }

    content_str = content_bytes.decode("utf-8", errors="replace")
    line_chunks = _chunk_by_lines(content_str)
    if line_chunks:
        return {
            "file_path": str(relative_path).replace("\\", "/"),
            "language": language,
            "chunks": line_chunks,
        }

    return None


def chunk_repository(repo_dir: Path) -> list[dict]:
    """Walk a cloned repo and return all chunks across all files."""
    all_chunks: list[dict] = []
    chunk_index = 0

    for root, dirs, files in os.walk(repo_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            fpath = Path(root) / fname
            relative = fpath.relative_to(repo_dir)
            result = chunk_file(repo_dir, relative)
            if result is None:
                continue
            for c in result["chunks"]:
                if len(c["content"]) > MAX_CHUNK_CHARS:
                    c["content"] = c["content"][:MAX_CHUNK_CHARS]
                all_chunks.append({
                    "file_path": result["file_path"],
                    "language": result["language"],
                    "start_line": c["start_line"],
                    "end_line": c["end_line"],
                    "content": c["content"],
                    "chunk_index": chunk_index,
                })
                chunk_index += 1

    return all_chunks