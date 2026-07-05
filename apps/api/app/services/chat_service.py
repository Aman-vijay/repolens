import asyncio
import json
import os
import time
import uuid
from typing import AsyncGenerator, List, Dict, Any
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import Project, Repository, RepositoryAnalysis, CodeChunk, RepositoryFile
from app.settings import get_settings
from app.schemas.chat import ChatMessage
from app.services.intent_router import route_query_intent
from app.services.search_engine import (
    SemanticSearcher,
    TextSearcher,
    FileSearcher,
    SnapshotSearcher,
    SearchResult
)

# Token estimation helper
def estimate_tokens(text: str) -> int:
    return len(text) // 4

# Prune conversation history to fit the token budget (~1500 tokens)
def enforce_history_budget(messages: List[Dict[str, Any]], max_tokens: int = 1500) -> List[Dict[str, Any]]:
    estimated = 0
    pruned = []
    # Work backwards to keep the latest messages
    for msg in reversed(messages):
        # Always keep system messages or tools for the current round
        if msg.get("role") == "system":
            continue
        msg_tokens = estimate_tokens(msg.get("content", ""))
        if estimated + msg_tokens <= max_tokens:
            pruned.insert(0, msg)
            estimated += msg_tokens
        else:
            break
    return pruned

async def stream_chat(
    db: AsyncSession,
    project_id: uuid.UUID,
    client_messages: List[ChatMessage]
) -> AsyncGenerator[str, None]:
    """OpenAI agent chat runner. Streams Vercel AI Data Stream Protocol events (v1).
    
    Data Stream Protocol format:
    - 0:"text_chunk"\n (text tokens)
    - 2:[{"trace":"message"}]\n (custom search/file read traces)
    - d:{"finishReason":"stop","usage":{}}\n (completions metadata)
    """
    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        yield f'3:"OPENAI_API_KEY is not configured on the backend."\n'
        return

    # Fetch Project & Repository
    project_stmt = select(Project).where(Project.id == project_id)
    project_res = await db.execute(project_stmt)
    project = project_res.scalar_one_or_none()
    if not project:
        yield f'3:"Project not found."\n'
        return

    repo_stmt = select(Repository).where(Repository.project_id == project_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalar_one_or_none()
    if not repo:
        yield f'3:"No repository attached to this project."\n'
        return

    # Fetch Latest Analysis for Repository Intelligence Context
    analysis_stmt = (
        select(RepositoryAnalysis)
        .where(RepositoryAnalysis.repository_id == repo.id)
        .where(RepositoryAnalysis.analysis_status == "success")
        .order_by(RepositoryAnalysis.analysis_version.desc())
        .limit(1)
    )
    analysis_res = await db.execute(analysis_stmt)
    analysis = analysis_res.scalar_one_or_none()

    # Formulate System Prompt with Repository Intelligence
    repo_intel = ""
    if analysis:
        repo_intel = (
            f"REPOSITORY CONTEXT:\n"
            f"- Executive Summary: {analysis.executive_summary or ''}\n"
            f"- Architecture Style: {analysis.architecture_style or ''}\n"
            f"- Layers: {', '.join(analysis.architecture_layers or [])}\n"
            f"- Tech Stack: {analysis.tech_stack or {}}\n"
        )

    system_prompt = (
        "You are an expert Senior Code Architect assisting developers with navigating and understanding this codebase.\n"
        "Your answers must be clear, objective, and highly professional. Follow this strict formatting template:\n\n"
        "1. Executive Summary: Short, direct response to the question.\n"
        "2. Execution Flow/Sequence: If explaining a process, outline steps or code call sequences.\n"
        "3. Relevant Files: List of key files with a brief description of what they do.\n"
        "4. Code Snippets: Key code selections with comments explaining implementation choices.\n"
        "5. Notes & Trade-offs: Design decisions, risks, or optimizations.\n"
        "6. Referenced Files: End your message with clickable markdown citations (MUST use line ranges if known):\n"
        "   Format: `[path/to/file.py:L10-L20](file:///path/to/file.py#L10-L20)`\n\n"
        f"{repo_intel}"
    )

    # Initialize tool choices
    tools = [
        {
            "type": "function",
            "function": {
                "name": "semantic_search",
                "description": "Semantic search over the codebase using embeddings. Best for general queries about how things work.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Conceptual search query"}
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "text_search",
                "description": "Exact text substring search. Best for finding specific symbols, configurations, variables, or functions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Exact text or identifier to match"}
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "find_files",
                "description": "Search for files by name pattern or file path matching.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Filename or path wildcard pattern"}
                    },
                    "required": ["pattern"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "view_file_content",
                "description": "Retrieve the full contents of a file. Use this after identifying a file through search.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Exact file path in the repository"}
                    },
                    "required": ["file_path"]
                }
            }
        }
    ]

    # Map message history
    history = []
    for msg in client_messages:
        history.append({"role": msg.role, "content": msg.content})

    user_query = client_messages[-1].content if client_messages else ""

    # Pre-LLM Intent Routing Heuristics
    pre_routed_context = ""
    intent = route_query_intent(user_query)

    if intent != "semantic":
        yield f'2:[{{"type":"trace","message":"🔍 Pre-routing query to {intent} searcher..."}}]\n'
        
        try:
            results = []
            if intent == "file":
                searcher = FileSearcher()
                results = await searcher.search(db, repo.id, user_query, limit=3)
            elif intent == "text":
                searcher = TextSearcher()
                results = await searcher.search(db, repo.id, user_query, limit=3)
            elif intent == "snapshot":
                searcher = SnapshotSearcher()
                results = await searcher.search(db, repo.id, user_query, limit=1)

            if results:
                # Format searcher results into context
                pre_routed_context = "\n\nPRE-ROUTED DIRECT RETRIEVAL CONTEXT:\n"
                for idx, r in enumerate(results):
                    pre_routed_context += f"Source [{r.file_path}]:\n{r.content}\n"
                    yield f'2:[{{"type":"trace","message":"📄 Pre-loaded {r.file_path}"}}]\n'
        except Exception as e:
            yield f'2:[{{"type":"trace","message":"⚠️ Pre-routing failed: {str(e)}"}}]\n'

    # Build the full messages array for OpenAI
    openai_messages = [{"role": "system", "content": system_prompt + pre_routed_context}]
    
    # Enforce history budget on historical turns
    openai_messages.extend(enforce_history_budget(history))

    client = AsyncOpenAI(api_key=api_key)

    # Loop logic with safety limits
    max_loops = 5
    loop_count = 0
    timeout_limit = 15.0 # 15 seconds per tool call

    while loop_count < max_loops:
        loop_count += 1
        
        # Call OpenAI Chat Completions API
        completion_stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            tools=tools,
            stream=True
        )

        tool_calls_accumulator = {}
        text_accumulator = ""

        # Read stream
        async for chunk in completion_stream:
            choice = chunk.choices[0]
            delta = choice.delta
            
            # Check for tool call generation
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_accumulator:
                        tool_calls_accumulator[idx] = {
                            "id": tc.id,
                            "name": "",
                            "arguments": ""
                        }
                    if tc.id:
                        tool_calls_accumulator[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_accumulator[idx]["name"] += tc.function.name
                        if tc.function.arguments:
                            tool_calls_accumulator[idx]["arguments"] += tc.function.arguments

            # Check for standard text generation
            elif delta.content:
                text_accumulator += delta.content
                # Stream text chunk to Vercel AI SDK UI (needs JSON string escaping)
                escaped = json.dumps(delta.content)
                yield f"0:{escaped}\n"

        # If there are no tool calls, the model is done, exit loop
        if not tool_calls_accumulator:
            break

        # Process tool calls
        # Append assistant message with tool call specifications
        assistant_message_content = {
            "role": "assistant",
            "content": text_accumulator if text_accumulator else None,
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]}
                }
                for tc in tool_calls_accumulator.values()
            ]
        }
        openai_messages.append(assistant_message_content)

        # Run each tool call in parallel or sequentially with timeout limits
        for tc in tool_calls_accumulator.values():
            tool_id = tc["id"]
            tool_name = tc["name"]
            tool_args = {}
            
            try:
                tool_args = json.loads(tc["arguments"])
            except Exception:
                pass

            # Update trace log on frontend
            yield f'2:[{{"type":"trace","message":"🔍 Calling tool {tool_name}..."}}]\n'

            tool_result = ""
            try:
                # 4-second timeout safety limit per tool call
                tool_result = await asyncio.wait_for(
                    execute_tool(db, repo.id, tool_name, tool_args),
                    timeout=timeout_limit
                )
            except asyncio.TimeoutError:
                await db.rollback()
                tool_result = json.dumps({"error": f"Tool {tool_name} timed out after {timeout_limit}s."})
                yield f'2:[{{"type":"trace","message":"⚠️ Tool timed out."}}]\n'
            except Exception as err:
                await db.rollback()
                tool_result = json.dumps({"error": f"Tool execution failed: {str(err)}"})
                yield f'2:[{{"type":"trace","message":"⚠️ Tool execution error."}}]\n'

            # Append tool result to context
            openai_messages.append({
                "role": "tool",
                "tool_call_id": tool_id,
                "content": tool_result
            })

    # Final trace update
    yield f'2:[{{"type":"trace","message":"✍️ Formulating answer..."}}]\n'


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
