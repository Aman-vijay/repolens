import asyncio
import json
import os
import uuid
from typing import AsyncGenerator, List, Dict, Any, Optional
from openai import AsyncOpenAI
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from repolens_db import (
    ChatMessage as ChatMessageModel,
    ChatSession,
    Project,
    Repository,
    RepositoryAnalysis,
    CodeChunk,
    RepositoryFile,
    User,
    get_async_session_factory,
)
from app.schemas.chat import ChatMessage, ChatMessageOut, ChatSessionOut, ChatSessionDetailOut
from app.services.search_engine import (
    SemanticSearcher,
    TextSearcher,
    FileSearcher,
    SearchResult
)

def _ui_chunk(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# --- Chat Session CRUD ---

async def create_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, title: str = "New Chat"
) -> ChatSession:
    session = ChatSession(project_id=project_id, user_id=user_id, title=title[:255])
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_or_create_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID,
    session_id: Optional[str], user_content: str,
) -> ChatSession:
    if session_id:
        try:
            sid = uuid.UUID(session_id)
            result = await db.execute(
                select(ChatSession).where(
                    ChatSession.id == sid,
                    ChatSession.project_id == project_id,
                    ChatSession.user_id == user_id,
                )
            )
            session = result.scalar_one_or_none()
            if session:
                return session
        except (ValueError, Exception):
            pass

    title = user_content[:100].strip() or "New Chat"
    return await create_session(db, project_id, user_id, title)


async def list_sessions(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> List[ChatSessionOut]:
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [ChatSessionOut.model_validate(s) for s in sessions]


async def get_session_detail(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, session_id: uuid.UUID
) -> ChatSessionDetailOut:
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.id == session_id,
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise ValueError("Session not found")

    return ChatSessionDetailOut(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            ChatMessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                extra=m.extra,
                created_at=m.created_at,
            )
            for m in session.messages
        ],
    )


async def save_message(
    db: AsyncSession, session_id: uuid.UUID, role: str, content: str,
    extra: Optional[dict] = None,
) -> ChatMessageModel:
    msg = ChatMessageModel(
        session_id=session_id,
        role=role,
        content=content,
        extra=extra,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def delete_session(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, session_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.project_id == project_id,
            ChatSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        return False
    await db.delete(session)
    await db.commit()
    return True


def _trace_chunk(message: str) -> str:
    return _ui_chunk(
        {
            "type": "data-trace",
            "data": {"type": "trace", "message": message},
            "transient": True,
        }
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


async def _stream_grounded_answer(
    client: AsyncOpenAI,
    openai_messages: List[Dict[str, Any]],
    message_id: str,
    text_part_id: str,
) -> AsyncGenerator[str, None]:
    completion_stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=openai_messages,
        stream=True,
        temperature=0.2,
    )

    text_started = False
    async for chunk in completion_stream:
        choice = chunk.choices[0]
        delta = choice.delta
        if not delta.content:
            continue

        if not text_started:
            yield _ui_chunk({"type": "start", "messageId": message_id})
            yield _ui_chunk({"type": "text-start", "id": text_part_id})
            text_started = True

        yield _ui_chunk({"type": "text-delta", "id": text_part_id, "delta": delta.content})

    if text_started:
        yield _ui_chunk({"type": "text-end", "id": text_part_id})
        yield _ui_chunk({"type": "finish", "finishReason": "stop"})
        yield "data: [DONE]\n\n"

async def stream_chat(
    db: AsyncSession,
    project_id: uuid.UUID,
    client_messages: List[ChatMessage],
    session_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
) -> AsyncGenerator[str, None]:
    """OpenAI agent chat runner using AI SDK UI message SSE chunks.

    If session_id and user_id are provided, persists the assistant response
    to the chat_messages table after streaming completes.
    """
    message_id = f"msg_{uuid.uuid4().hex}"
    text_part_id = f"text_{uuid.uuid4().hex}"
    message_started = False
    text_stream_started = False
    full_assistant_text = ""  # Accumulate for DB persistence

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        yield _ui_chunk({"type": "start", "messageId": message_id})
        yield _ui_chunk({"type": "text-start", "id": text_part_id})
        yield _ui_chunk({"type": "text-delta", "id": text_part_id, "delta": "The backend is missing OPENAI_API_KEY, so codebase chat cannot answer yet."})
        yield _ui_chunk({"type": "text-end", "id": text_part_id})
        yield _ui_chunk({"type": "finish", "finishReason": "error"})
        return

    # Fetch Project & Repository
    project_stmt = select(Project).where(Project.id == project_id)
    project_res = await db.execute(project_stmt)
    project = project_res.scalar_one_or_none()
    if not project:
        yield _ui_chunk({"type": "error", "errorText": "Project not found."})
        return

    repo_stmt = select(Repository).where(Repository.project_id == project_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalar_one_or_none()
    if not repo:
        yield _ui_chunk({"type": "error", "errorText": "No repository attached to this project."})
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

    user_query = client_messages[-1].content if client_messages else ""

    yield _trace_chunk("Gathering repository evidence...")
    grounding_context, evidence_count, trace_messages, grounded_files = await _build_grounding_context(
        db=db,
        repo_id=repo.id,
        user_query=user_query,
        analysis=analysis,
    )
    for trace_message in trace_messages:
        yield _trace_chunk(trace_message)

    system_prompt = (
        "You are an expert Senior Code Architect assisting developers with navigating and understanding this codebase.\n"
        "You are answering a question about a specific repository, not giving generic software advice.\n"
        "Never say the user did not provide a question when the latest user message is non-empty.\n"
        "Base your answer on the retrieved repository evidence first. If the evidence is thin, say exactly what is missing instead of guessing.\n"
        "Never invent or infer file paths that do not appear in the retrieved evidence.\n"
        "If you only have analysis metadata for a claim, say that explicitly as 'based on repository analysis metadata'.\n"
        "If the current evidence is insufficient, use the available tools before answering.\n"
        "When you mention files, prefer files present in the retrieved context or tool output.\n"
        "Only cite or name files from the allowed retrieved file list below.\n"
        "Use this strict formatting template:\n\n"
        "1. Executive Summary: Short, direct response to the question.\n"
        "2. Execution Flow/Sequence: If explaining a process, outline steps or code call sequences.\n"
        "3. Relevant Files: List of key files with a brief description of what they do.\n"
        "4. Code Evidence: Quote or summarize the specific retrieved code evidence that supports your answer.\n"
        "5. Notes & Trade-offs: Design decisions, risks, or optimizations.\n"
        "6. Referenced Files: End your message with clickable markdown citations. Use line ranges when provided, otherwise cite the file path only.\n"
        "   Formats:\n"
        "   `[path/to/file.py:L10-L20](file:///path/to/file.py#L10-L20)`\n"
        "   `[path/to/file.py](file:///path/to/file.py)`\n\n"
        f"ALLOWED RETRIEVED FILES:\n{chr(10).join(f'- {file_path}' for file_path in grounded_files) or '- none'}\n\n"
        f"RETRIEVED REPOSITORY EVIDENCE:\n{grounding_context or 'No repository evidence was retrieved yet.'}\n\n"
        f"EVIDENCE COUNT: {evidence_count}"
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

    # Build the full messages array for OpenAI
    openai_messages = [{"role": "system", "content": system_prompt}]
    
    # Enforce history budget on historical turns
    openai_messages.extend(enforce_history_budget(history))

    client = AsyncOpenAI(api_key=api_key)

    # If we already have grounded repository evidence, answer directly from it.
    # This is much more reliable than entering the tool loop for broad repo questions.
    if evidence_count > 0:
        yield _trace_chunk("Composing answer from grounded repository context...")
        streamed_any_text = False

        async def _accumulate_grounded():
            nonlocal full_assistant_text
            async for part in _stream_grounded_answer(
                client=client,
                openai_messages=openai_messages,
                message_id=message_id,
                text_part_id=text_part_id,
            ):
                if '"type":"text-delta"' in part:
                    try:
                        payload = json.loads(part.replace("data: ", "").strip())
                        if payload.get("type") == "text-delta":
                            full_assistant_text += payload.get("delta", "")
                    except Exception:
                        pass
                yield part

        async for part in _accumulate_grounded():
            streamed_any_text = True
            text_stream_started = True
            message_started = True
            yield part

        if streamed_any_text:
            if session_id and user_id and full_assistant_text.strip():
                session_factory = get_async_session_factory()
                async with session_factory() as save_session:
                    await save_message(save_session, session_id, "assistant", full_assistant_text)
            return
        yield _trace_chunk("Grounded answer stream returned no text, falling back to tool retrieval...")

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

            # Buffer standard text generation. Only emit it after the loop
            # when we know this pass does not continue into more tool calls.
            elif delta.content:
                text_accumulator += delta.content

        # If there are no tool calls, the model is done, exit loop
        if not tool_calls_accumulator:
            if text_accumulator.strip():
                full_assistant_text += text_accumulator
                if not message_started:
                    yield _ui_chunk({"type": "start", "messageId": message_id})
                    message_started = True
                if not text_stream_started:
                    yield _ui_chunk({"type": "text-start", "id": text_part_id})
                    text_stream_started = True
                yield _ui_chunk({"type": "text-delta", "id": text_part_id, "delta": text_accumulator})
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
            yield _trace_chunk(f"Calling tool {tool_name}...")

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
                yield _trace_chunk(f"Tool {tool_name} timed out.")
            except Exception as err:
                await db.rollback()
                tool_result = json.dumps({"error": f"Tool execution failed: {str(err)}"})
                yield _trace_chunk(f"Tool {tool_name} execution error.")

            # Append tool result to context
            openai_messages.append({
                "role": "tool",
                "tool_call_id": tool_id,
                "content": tool_result
            })

    # Final trace update
    if not text_stream_started:
        fallback_text = (
            "I could not gather enough grounded repository evidence to produce a reliable answer. "
            "Please retry after the repository analysis and index are complete, or ask about a more specific file or symbol."
        )
        full_assistant_text = fallback_text
        yield _ui_chunk({"type": "start", "messageId": message_id})
        yield _ui_chunk({"type": "text-start", "id": text_part_id})
        yield _ui_chunk({"type": "text-delta", "id": text_part_id, "delta": fallback_text})
        text_stream_started = True

    if text_stream_started:
        yield _ui_chunk({"type": "text-end", "id": text_part_id})
    yield _ui_chunk({"type": "finish", "finishReason": "stop"})
    yield "data: [DONE]\n\n"

    # Persist assistant message to DB
    if session_id and user_id and full_assistant_text.strip():
        session_factory = get_async_session_factory()
        async with session_factory() as save_session:
            await save_message(save_session, session_id, "assistant", full_assistant_text)


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
