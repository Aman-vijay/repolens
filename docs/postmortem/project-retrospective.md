# Project Retrospective — RepoLens

**Date**: July 2026
**Status**: Milestone 8 Complete — Production Ready

---

## Executive Summary

RepoLens is a web application that helps engineers understand and plan changes in unfamiliar codebases. The system provides AI-generated repository summaries, semantic code search, conversational code exploration, and structured implementation planning.

---

## Architecture Decisions We Got Right

### 1. Peer Architecture for API and Workers (ADR 0001)

**Decision**: API and Workers are peers, both depending on a shared `packages/db`.

**Why it worked**: Clear separation of concerns. The API handles synchronous HTTP requests while Workers handle long-running background jobs independently. This allowed parallel development and independent scaling.

**Lesson**: Always define dependency direction explicitly. If Workers had imported from API, we'd have circular dependency problems.

### 2. Managed Infrastructure (ADR 0004)

**Decision**: Use Neon (Postgres+pgvector) and Upstash Redis instead of self-hosted.

**Why it worked**: Zero operational overhead for database management. pgvector extension works identically in Neon vs local Postgres. Upstash's Redis compatibility meant minimal code changes.

**Trade-off**: Cost is higher than self-hosted, but developer time saved far exceeds the cost.

### 3. ARQ over Celery (ADR 0005)

**Decision**: Use ARQ for job queue instead of Celery.

**Why it worked**: ARQ is lightweight, has async support, and integrates naturally with our async FastAPI app. The "durability" mode ensures jobs aren't lost on crashes.

**Trade-off**: ARQ has fewer features than Celery, but we didn't need them.

### 4. Semantic Search via Embeddings (ADR 0020)

**Decision**: Chunk code, generate embeddings, store in pgvector, search via cosine similarity.

**Why it worked**: Provides genuinely useful semantic search. "How does authentication work?" returns relevant code, not just filename matches.

**Trade-off**: Embedding generation is slow (500-2000ms per query). Could optimize with batch embedding or caching.

### 5. Clerk Authentication (ADR 0009)

**Decision**: Use Clerk with lazy user upsert.

**Why it worked**: Clerk handles all auth complexity (OAuth, session management, webhooks). Lazy upsert means we only write to our DB on second login, reducing write load.

**Lesson**: The webhook secret rotation strategy (ADR 0009) was important—don't skip it.

---

## Architecture Decisions We Reconsidered

### JSONB vs Separate Tables

**Initial**: Used JSONB for flexible metadata.
**Changed**: Created separate tables when we needed to query structured fields (e.g., `tech_stack`, `languages`).

**Trade-off**: More schema complexity, but better query performance and type safety.

### Snapshot Hash for Analysis Cache Invalidation

**Initial**: No caching for analysis results.
**Changed**: Added `snapshot_hash` to detect when repo content changed (ADR 0013).

**Why**: Avoid regenerating analysis for unchanged repos. The hash is computed from file content + tree structure.

---

## Technical Debt Accepted

| Item | Why Accepted | Mitigation |
|------|--------------|------------|
| Tree-sitter for all languages | Complete language support | Alternative: use multiple parsers |
| No real-time updates | Complexity vs benefit | Polling works acceptably |
| SQLite in tests (now removed) | Speed | Using Testcontainers for real Postgres |
| No code generation | Scope management | Plans only, no code output |

---

## Security Considerations

### What We Protected

1. **CORS**: Restricted to configured frontend URL
2. **Clerk JWT validation**: Every API route validates tokens
3. **Project ownership**: All data operations check user owns the project
4. **Input validation**: Pydantic schemas validate all inputs
5. **Prompt injection**: Grounding prevents hallucinated file references
6. **Markdown XSS**: Code blocks are sanitized

### What We'd Add in Production

1. Rate limiting per-user (currently per-IP)
2. API key rotation mechanism
3. Audit logging for admin actions
4. Dependency vulnerability scanning
5. Penetration testing

---

## Performance Observations

| Operation | p50 | p95 | Notes |
|-----------|-----|-----|-------|
| Repo Import | 15s | 30s | Clone + chunk + embed |
| Semantic Search | 250ms | 500ms | Embed + pgvector |
| Chat First Token | 800ms | 1.5s | Grounding + LLM |
| Plan Generation | 5s | 10s | Full JSON output |

**Key insight**: OpenAI API latency dominates. Embedding generation is the second bottleneck.

---

## What We'd Do Differently

1. **Start with Testcontainers from day one**: Integration tests with real Postgres/Redis catch bugs that mocks miss. We originally used mocks and spent time later migrating.

2. **Separate embedding service earlier**: Currently coupled with analysis. Should have been a standalone worker job from the start.

3. **Design the plan schema before implementation**: We iterated on the plan JSON schema multiple times. More upfront design would have saved rework.

4. **Add performance monitoring earlier**: We added structlog latency tracking in M8. Should have been in M1.

---

## Team Workflow Lessons

### What Worked

- **ADRs for significant decisions**: Writing down context and trade-offs prevented scope creep and aligned the team.
- **Monorepo with clear package boundaries**: `packages/db` and `packages/prompts` are properly isolated.
- **Makefile for common operations**: Reduced friction for development tasks.

### What Didn't Work

- **Waiting too long on testing infrastructure**: Original plan had "M8 for testing" which was too late.
- **Not enough attention to error messages**: Users struggled to understand why jobs failed. Error UX needs improvement.

---

## Feature Freeze Rationale

We deliberately avoided:

- **Code generation**: Hallucination risk too high without extensive verification
- **Real-time collaboration**: Complexity vs user benefit ratio unfavorable
- **Multiple AI providers**: Added complexity without clear benefit
- **Mobile app**: Different UX requirements, separate effort

---

## Future Considerations (Post-M1)

1. **Caching layer**: Cache embedding results for unchanged files
2. **Batch processing**: Group multiple repos for analysis
3. **Custom embedding model**: Fine-tune for code-specific embeddings
4. **Export**: PDF/Markdown export of analysis and plans
5. **Team features**: Shared projects, comments, annotations

---

## Conclusion

RepoLens achieved its goals: help engineers understand unfamiliar codebases through AI-powered analysis, search, chat, and planning. The architecture choices proved sound for the scope. Technical debt is manageable, and the system is ready for production deployment with proper monitoring and operational setup.

---

## Appendix: ADRs Reference

| ADR | Title |
|-----|-------|
| 0001 | Monorepo layout and dev/prod parity |
| 0004 | Managed data infra (Neon + Upstash) |
| 0005 | Queue library (ARQ) |
| 0009 | Auth architecture (Clerk lazy upsert) |
| 0013 | Clone service (shallow clone, background tasks) |
| 0017 | ARQ durable queue |
| 0020 | Semantic code search via chunking/embeddings/pgvector |
| 0021 | AI platform reliability metrics |
