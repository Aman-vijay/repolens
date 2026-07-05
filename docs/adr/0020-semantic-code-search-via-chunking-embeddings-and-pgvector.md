# ADR 0020: Semantic code search via chunking, embeddings, and pgvector

**Status:** Accepted  
**Date:** 2026-07-04

## Context

Milestone 4 adds the first AI-assisted repository understanding feature: semantic code search. Repo-level metadata from Milestone 2 is useful for navigation, but not enough to answer questions like "where is webhook verification handled?" or "show me the retry logic." We need a retrieval pipeline that can index repository code once and return relevant code slices quickly at query time.

## Decision

Use a chunk-and-embed pipeline stored in Postgres with pgvector:

1. The ARQ worker chunks cloned repositories into semantic units after metadata extraction.
2. Tree-sitter is the primary chunking strategy, extracting top-level functions, classes, and similar definitions per language.
3. When a language grammar is unavailable or parsing yields no structural chunks, fall back to fixed-size line chunks.
4. Each chunk is stored in a `code_chunks` table with repository ownership, file path, language, line range, content, chunk index, and a 1536-dimension embedding vector.
5. Query-time search embeds the user's prompt with the same embedding model and runs cosine similarity search against that project's chunks only.
6. The dashboard exposes semantic search on the project detail page once a repository reaches `ready`.

## Why this shape

- Chunking during the worker job keeps indexing off the request path.
- Tree-sitter gives better retrieval units than raw line windows for supported languages.
- Pgvector keeps embeddings in the same primary data store as repository state, avoiding a second retrieval system.
- Project-scoped search prevents cross-project leakage and keeps authorization simple.
- A fallback chunker keeps indexing resilient when grammar coverage is incomplete.

## Rejected alternatives

- **Whole-file embeddings only**: Too coarse; large files mix unrelated concerns and weaken recall.
- **Raw line-window chunking only**: Simpler, but loses semantic boundaries in languages we can parse well.
- **Dedicated vector database**: Unnecessary operational surface area at this milestone; Neon + pgvector already covers the need.
- **Query code with lexical search only**: Faster to build, but it misses semantically similar code when exact tokens differ.

## Consequences

- Worker jobs now do more work before a repository becomes `ready`, so indexing latency increases versus Milestone 3.
- `code_chunks` can grow quickly on large repositories, so chunk caps and file-size guards are part of the first implementation.
- Query-time search depends on a live embedding request, which adds API latency and requires OpenAI availability.
- The current dashboard returns matching snippets only; answer synthesis remains a Milestone 5+ concern.

## Revisit trigger

- If indexing time becomes too slow on large repositories, add staged jobs or separate queues for clone and embed phases.
- If retrieval quality is poor, revisit chunk boundaries, overlap, or hybrid lexical + vector ranking.
- If embeddings volume or query load outgrows Postgres, evaluate a dedicated vector store.
