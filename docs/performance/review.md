# Performance Review

## Overview

This document tracks latency baselines and performance characteristics for RepoLens core operations.

## Core Operations Latency Baselines

### 1. Repository Analysis

| Stage | Expected Latency | Notes |
|-------|-----------------|-------|
| File Chunking | 100-500ms | Depends on repo size (file count) |
| Tree-sitter Parsing | 200-1000ms | Language detection + AST extraction |
| Embedding Generation | 500-2000ms | OpenAI `text-embedding-3-small` API |
| pgvector Upsert | 50-200ms | Bulk insert with index |
| Analysis LLM Call | 2000-8000ms | GPT-4o-mini with ~500 token output |
| **Total** | **3000-12000ms** | End-to-end for typical repos |

### 2. Semantic Search

| Stage | Expected Latency | Notes |
|-------|-----------------|-------|
| Query Embedding | 150-500ms | OpenAI embeddings API |
| pgvector Cosine Similarity | 10-50ms | Per-project vector search |
| Result Formatting | 5-20ms | JSON serialization |
| **Total** | **200-600ms** | Network round-trip dominant |

### 3. Chat Streaming

| Stage | Expected Latency | Notes |
|-------|-----------------|-------|
| Grounding Retrieval | 50-200ms | Chunk lookup + context building |
| LLM First Token | 500-1500ms | Time to first token (TTFT) |
| LLM Completion | 1000-5000ms | Total streaming time |
| **Total (first-token)** | **550-1700ms** | Per-message latency |
| **Total (full)** | **1500-6500ms** | Including streaming |

### 4. Planner

| Stage | Expected Latency | Notes |
|-------|-----------------|-------|
| Context Retrieval | 50-200ms | Similar to chat grounding |
| Plan Generation LLM | 2000-10000ms | Structured JSON output |
| **Total** | **2050-10200ms** | Single plan generation |

## Profiling Instrumentation

All core operations use `LatencyTracker` from `app/services/performance.py`:

```python
from app.services.performance import profile_latency, LatencyTracker

# Simple operation
async with profile_latency("search_embedding", query="user query"):
    embedding = await generate_embedding(query)

# Multi-stage operation
tracker = LatencyTracker("analysis", request_id="abc123")
tracker.start_stage("chunking")
await chunk_files()
tracker.end_stage("chunking", file_count=42)

tracker.start_stage("embedding")
await generate_embeddings()
tracker.end_stage("embedding", chunk_count=128)

tracker.log_total()
```

## Optimization Targets

| Operation | Target p50 | Target p95 | Target p99 |
|-----------|------------|------------|------------|
| Repository Analysis | 5s | 8s | 10s |
| Semantic Search | 200ms | 400ms | 600ms |
| Chat First Token | 800ms | 1.2s | 1.5s |
| Planner Generation | 5s | 8s | 10s |

## Known Bottlenecks

1. **OpenAI API Latency** - Embeddings and LLM calls dominate latency
2. **Postgres Vector Index** - pgvector HNSW vs IVFFlat affect search speed
3. **Tree-sitter Parsing** - Large repos with many languages slow down

## Monitoring Recommendations

- Log `latency_ms` for all operations with `structlog`
- Export metrics to Datadog/Prometheus via OpenTelemetry
- Set up alerts for p95 > 2x baseline
