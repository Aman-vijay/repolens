# RepoLens — AI Engineering Playbook

This playbook documents how RepoLens designs, monitors, validates, and evolves its AI capabilities in production.

---

## 1. How Repository Intelligence Works

The AI Repository Intelligence pipeline is orchestrated in the background worker:

```
[Clone Repository]
       ↓
[Snapshot Builder] (Build outline, read manifests, extract README)
       ↓
[Deterministic Extractor] (Verify framework, package manager, and license)
       ↓
[Prompt Assembler] (Synthesize Markdown system/user prompt)
       ↓
[LLM Client Call] (gpt-4o-mini structured outputs call with jittered retry)
       ↓
[Merge & Override] (Deterministic facts override LLM facts)
       ↓
[Database Persistence] (Save summaries and token usage metrics)
```

---

## 2. Prompt Versioning & Storage

Prompts are stored inside the shared prompts package:
- **Location**: `packages/prompts/src/prompts/`
- **Format**: Markdown files containing clear `# System Prompt` and `# User Prompt` separators, using Jinja2 syntax for context rendering.
- **Versioning**: Tracked via the `prompt_version` string stored alongside each analysis database record (e.g., `v1.0.0`). Every time the prompt template changes, increment the version tracker in the worker.
- **Changelog**: Log changes in `packages/prompts/CHANGELOG.md`.

---

## 3. How to Evaluate Prompt Changes

To prevent regressions in prompt quality:
1. **Fixture Baseline**: Stored in `evaluation/fixtures/` as JSON snapshots with expected metadata assertions.
2. **Evaluation Suite**: Run the evaluation runner:
   - **Smoke Mode**: Runs locally without API keys, validating template rendering and Pydantic schema validation.
     ```bash
     uv run python evaluation/evaluate_prompts.py --mode smoke
     ```
   - **Live Mode**: Calls live OpenAI endpoints to verify model responses.
     ```bash
     uv run python evaluation/evaluate_prompts.py --mode live
     ```
3. **Reports**: Outputs both `evaluation/report.json` and `evaluation/report.md` for simple local reviews and CI integration.

---

## 4. Failure & Retry Management

AI operations are protected against transient errors:

### Error Classification Table

| Error Code | Category | Retryable | Description |
|---|---|---|---|
| `rate_limit` | RateLimitError | **Yes** | OpenAI API rate limits or quota bounds |
| `timeout` | APITimeoutError | **Yes** | Connection or read timeout |
| `network_error` | APIConnectionError | **Yes** | Client connection failures |
| `provider_error` | InternalServerError / status codes | **Yes** | Transient provider side crash |
| `validation_error` | BadRequestError | **No** | Schema structure mismatch |
| `unexpected_error` | General Python exception | **No** | Internal system bugs |

### Retry Strategy with Jitter
For retryable errors, the worker executes a client-side retry loop with exponential backoff and randomized full jitter:
- **Max Retries**: 3
- **Base Delay**: 2.0s
- **Formula**: `delay = random.uniform(0, base_delay * (2 ** (retry - 1)))` (prevents thundering herds under heavy loads).

---

## 5. Cost Tracking & Token Metrics

Estimated token costs are derived from stored metrics rather than hard-coded database values:
- **Database Storage**: We persist raw token usage (`prompt_tokens`, `completion_tokens`, `total_tokens`) in `token_usage` JSONB.
- **Log Observability**: The background worker calculates and logs estimated USD cost for instant tracing.
- **On-the-fly Derivation**: Frontends/displays parse stored token metrics and multiply by model rates (e.g. `gpt-4o-mini`: $0.15/1M input, $0.60/1M output) dynamically, avoiding schema migration issues if rates change.
