# ADR 0012: Repository data model — separate table with JSONB metadata

**Status:** Accepted  
**Date:** 2026-07-03

## Context

Milestone 2 introduces repository cloning and metadata extraction. We need to store the clone URL, status, and extracted metadata (file tree, language breakdown, file count, total size) for each project. The data model must support future milestones (M4 chunking, M5 AI summary) without schema migrations.

## Decision

Create a separate `repositories` table with a 1:1 relationship to `projects` (enforced by a unique constraint on `project_id`). The model supports 1:N in the future by relaxing the unique constraint.

Metadata is stored in PostgreSQL `JSONB` columns:
- `file_tree` — nested directory tree structure.
- `languages` — per-language statistics `{lang: {files: N, bytes: N}}`.

## Why a separate table

- Keeps the `projects` table stable for project-level queries.
- Metadata is large (file trees can be hundreds of KB); querying `projects` shouldn't scan it.
- A future `projects` → many `repositories` scenario requires only dropping the unique constraint.

## Why JSONB

- File trees and language breakdowns are variable-shaped; a relational schema would be overfit.
- JSONB is queryable (GIN index available later for language filters).
- No ORM model changes needed for new metadata fields — just update the dict.

## Rejected alternatives

- **Extend `projects` with repo columns**: Couples project and repo lifecycles; large JSON columns pollute every project query.
- **EAV (entity-attribute-value) for metadata**: Overkill; JSONB is simpler and queryable.

## Consequences

- The `repositories` table is the source of truth for repo lifecycle and metadata.
- `file_tree` is capped at 4 levels of depth; deeper levels are truncated in the extraction service.
- M4/M5 can add new columns (e.g., `chunks`, `embeddings`) or reuse JSONB as needed.

## Revisit trigger

- If the file tree is too large to serialize → store in R2/Indexed EAV.
- If 1:N is needed → drop the unique constraint and update the ORM relationship.