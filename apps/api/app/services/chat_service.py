import asyncio
import json
import os
import uuid
from typing import AsyncGenerator, List, Dict, Any, Optional

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from repolens_db import (
    Project,
    Repository,
    RepositoryAnalysis,
    get_async_session_factory,
)
from app.schemas.chat import ChatMessage

# Re-exports for backward compatibility and routes
from app.services.chat_crud import (
    create_session,
    get_or_create_session,
    list_sessions,
    get_session_detail,
    save_message,
    delete_session,
)

# Internals from extracted services
from app.services.chat_grounding import _build_grounding_context
from app.services.chat_tools import execute_tool


def _ui_chunk(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _trace_chunk(message: str) -> str:
    return _ui_chunk(
        {
            "type": "data-trace",
            "data": {"type": "trace", "message": message},
            "transient": True,
        }
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
    saved = False

    async def save_db_if_needed():
        nonlocal saved
        if not saved and session_id and user_id and full_assistant_text.strip():
            try:
                session_factory = get_async_session_factory()
                async with session_factory() as save_session:
                    await save_message(save_session, session_id, "assistant", full_assistant_text)
                saved = True
            except Exception:
                pass

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
                try:
                    payload = json.loads(part.replace("data: ", "").strip())
                    if isinstance(payload, dict) and payload.get("type") == "text-delta":
                        full_assistant_text += payload.get("delta", "")
                except Exception:
                    pass
                yield part

        try:
            async for part in _accumulate_grounded():
                streamed_any_text = True
                text_stream_started = True
                message_started = True
                yield part
        finally:
            await save_db_if_needed()

        if streamed_any_text:
            return
        yield _trace_chunk("Grounded answer stream returned no text, falling back to tool retrieval...")

    try:
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
    finally:
        await save_db_if_needed()
