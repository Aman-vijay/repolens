# RepoLens Prompts Changelog

All notable changes to the RepoLens repository intelligence prompts will be documented in this file.

## [1.0.0] - 2026-07-05

### Added
- Created Jinja2 prompt compilation standard in `packages/prompts/src/prompts/`.
- Implemented structured XML layout for prompts (`<repository_context>`, `<file_tree>`, `<manifests>`, `<readme>`) in `packages/prompts/src/prompts/intelligence.md`.
- Configured prompt context mapping schemas:
  - `LLMAnalysisOutput` to validate outputs (summary, style, tiers, tech stack, facts, insights).
  - `LLMSearchExplanation` to handle contextual chunk explanation, role classification, and highlights.
- Defined pricing calculation constants and structured error classification defaults.
