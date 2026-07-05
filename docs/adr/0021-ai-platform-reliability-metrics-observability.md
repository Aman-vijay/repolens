# ADR 0021: AI Platform Reliability, Metrics, and Observability

## Status

Accepted

## Context

In Milestone 5, we built the core Repository Intelligence pipeline. However, operating AI features in production requires structured visibility, reliability under API rate limits/timeouts, cost management, and prompt regression testing. We need an architectural standard that covers cost logging, error classification, automated retries, and prompt evaluations.

## Decision

We will implement a unified AI Platform Reliability and Observability architecture:

1. **Structured Error Codes**: Introduce specific error categories to classify exceptions during analysis runs:
   - `rate_limit`: API quota or rate limit exceeded.
   - `timeout`: Network timeout waiting for the provider.
   - `network_error`: Transient client connection issues.
   - `provider_error`: Internal server error on the provider side.
   - `validation_error`: Invalid inputs, parameters, or schema validation failures.
   - `unexpected_error`: General unhandled Python/worker exceptions.

2. **Database Columns**: Extend the `repository_analyses` database table to persist `error_code` (for failure diagnosis). We store raw token metrics in the existing `token_usage` JSONB column rather than storing hardcoded cost figures in DB, allowing pricing to be calculated dynamically in views.

3. **Client-Side Exponential Retry Loop with Jitter**: Implement a retry loop with exponential backoff and randomized full jitter (`random.uniform(0, base_delay * (2 ** (retry - 1)))`) directly surrounding the OpenAI API call inside the background worker. Retries are restricted to *retryable* errors (e.g. `rate_limit`, `timeout`, `network_error`).

4. **Correlation IDs in Logs**: Include `analysis_id`, `repository_id`, and `worker_job_id` in all structured logs for end-to-end trace correlation.

5. **Prompt Evaluation Framework**: Establish a prompt evaluation suite using static baseline fixtures in `evaluation/fixtures/` and a local runner script `evaluation/evaluate_prompts.py` supporting explicit `--mode smoke` and `--mode live` flags.

## Consequences

- **Observable Pipelines**: Failures in the worker are easily queried and aggregated in PostgreSQL by `error_code`.
- **API Call Stability**: Transient rate limits and timeout failures are resolved automatically without failing the entire repository cloning job, protected against thundering herd retry cycles.
- **Cost Controls**: Token metrics are saved, and costs can be computed dynamically.
- **Prompt Safety**: Regression testing of prompt templates is automated using mock repository snapshots and schema completeness checks.
