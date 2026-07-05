# RepoLens — Prompting Guidelines & Conventions

This guide defines the standards for authoring, versioning, and modifying prompts in the RepoLens codebase.

---

## 1. Directory Structure

All prompt templates must be placed inside the unified prompts package:
`packages/prompts/src/prompts/`

Every prompt template is split into two sections separated by clear Markdown headers:
- `# System Prompt`: Contains core rules, output schemas, and behavioral guidelines for the assistant.
- `# User Prompt`: Contains dynamic variables, context templates, and the specific query.

---

## 2. Context Isolation (XML Boundaries)

When inserting user code, READMEs, file trees, or configuration manifests, always isolate the data inside XML tags:

```xml
<readme_content>
{{ readme_content }}
</readme_content>

<file_tree>
{{ file_tree_outline }}
</file_tree>
```

This prevents prompt injection and helps the LLM distinguish between developer instructions and parsed code content.

---

## 3. Dynamic Compiling (Jinja2)

Use Jinja2 variables and controls for conditional rendering:
- Always define fallbacks for optional variables (e.g. `{{ readme_content or 'No readme found' }}`).
- Loop over collections cleanly:
  ```jinja
  {% for file_path, content in manifest_snippets.items() %}
  --- File: {{ file_path }} ---
  {{ content }}
  {% endfor %}
  ```

---

## 4. Structured Output Enforcement

Do not rely on the LLM generating loose JSON in plain markdown blocks. Always pair the prompt with a Pydantic output schema (e.g. `LLMAnalysisOutput`) and enforce parser validation via the OpenAI Structured Outputs API (`client.beta.chat.completions.parse`).

If you modify the prompt to request new metrics or facts:
1. Update the Pydantic schema in `workers/analysis_service.py` (or `apps/api/app/schemas/`).
2. Update the template to explain how the new fields must be generated.

---

## 5. Review & Testing Workflow

Before committing any prompt adjustments:
1. **Local Smoke Check**: Run `uv run python evaluation/evaluate_prompts.py --mode smoke` to verify Jinja compilation and schema completeness.
2. **Regression Check**: If you have a live OpenAI key, run with `--mode live` to verify that GPT extracts the values correctly from fixture snapshots.
3. **Changelog**: Append a description of the change to `packages/prompts/CHANGELOG.md` with an incremented version number.
