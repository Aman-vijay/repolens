"""Prompt Evaluation Runner for RepoLens.

Supports smoke mode (mocked LLM) and live mode (real OpenAI calls).
Produces JSON and Markdown evaluation reports.

Usage:
  uv run python evaluation/evaluate_prompts.py --mode smoke
  uv run python evaluation/evaluate_prompts.py --mode live
"""
import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

# Add root folder to sys.path
root_path = Path(__file__).resolve().parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from prompts import build_intelligence_prompt
from workers.analysis_service import LLMAnalysisOutput, TechStack, RepoFacts, RepoInsights
from openai import OpenAI

def run_evaluation():
    parser = argparse.ArgumentParser(description="Evaluate RepoLens prompts against baselines.")
    parser.add_argument(
        "--mode",
        choices=["smoke", "live"],
        default="smoke",
        help="Evaluation mode. 'smoke' uses mocked LLM outputs, 'live' calls OpenAI."
    )
    args = parser.parse_args()

    print("=" * 60)
    print(f" REPOLENS PROMPT EVALUATION RUNNER (Mode: {args.mode.upper()})")
    print("=" * 60)

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if args.mode == "live" and not api_key:
        print("[ERROR] OPENAI_API_KEY environment variable is required for live mode.")
        sys.exit(1)

    fixtures_dir = Path(__file__).resolve().parent / "fixtures"
    fixture_files = list(fixtures_dir.glob("*.json"))

    if not fixture_files:
        print("[ERROR] No fixture files found in evaluation/fixtures/.")
        sys.exit(1)

    report_details = []
    global_passed = True

    for fpath in fixture_files:
        print(f"\nFixture: {fpath.name}")
        print("-" * 40)
        
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        snap = data["snapshot"]
        assertions = data["assertions"]

        # 1. Render Prompts
        context = {
            "repo_url": snap["repo_url"],
            "readme_content": snap["readme_content"],
            "manifest_snippets": snap["manifest_snippets"],
            "file_tree_outline": snap["file_tree_outline"],
            "language_stats": snap["language_stats"]
        }
        
        prompt_render_passed = True
        prompt_render_error = None
        system_prompt, user_prompt = "", ""
        try:
            system_prompt, user_prompt = build_intelligence_prompt(context)
            print("[OK] Prompts compiled and rendered successfully.")
        except Exception as exc:
            prompt_render_passed = False
            prompt_render_error = str(exc)
            print(f"[FAIL] Prompt compiling failed: {exc}")

        result = None
        failed_assertions = []

        if not prompt_render_passed:
            global_passed = False
            report_details.append({
                "fixture": fpath.name,
                "passed": False,
                "prompt_rendered": False,
                "error": prompt_render_error,
                "failures": ["Prompt compiler crash"]
            })
            continue

        # 2. Get Structured Output
        if args.mode == "smoke":
            # Mock structured output based on expected assertions
            result = LLMAnalysisOutput(
                executive_summary="This is a mock repository executive summary generated for testing.",
                architecture_summary="This is a mock layout structure of the directory.",
                architecture_style=assertions.get("architecture_style", "layered"),
                architecture_layers=["app", "routes", "tests"],
                tech_stack=TechStack(
                    languages=[assertions.get("primary_language", "Python")],
                    frameworks=[assertions.get("primary_framework", "FastAPI")],
                    tools=["docker"] if assertions.get("containerized") else []
                ),
                repo_facts=RepoFacts(
                    primary_language=assertions.get("primary_language", "Python"),
                    repository_type="boilerplate",
                    primary_framework=assertions.get("primary_framework", "FastAPI"),
                    package_manager=assertions.get("package_manager", "pip"),
                    containerized=assertions.get("containerized", True),
                    ci_detected=False,
                    license="MIT",
                    documentation_quality="average"
                ),
                repo_insights=RepoInsights(
                    strengths=["Clean module imports"],
                    risks=["No high-level tests found"],
                    notable_decisions=["Jinja2 templates for prompts"],
                    patterns_detected=["Repository pattern"]
                )
            )
            print("[OK] Smoke mode: Loaded mock structured Pydantic output.")
        else:
            print("Calling live OpenAI API (gpt-4o-mini)...")
            client = OpenAI(api_key=api_key)
            try:
                completion = client.beta.chat.completions.parse(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format=LLMAnalysisOutput,
                    temperature=0.1,
                    timeout=45.0
                )
                result = completion.choices[0].message.parsed
                if not result:
                    raise RuntimeError("Empty structured response returned from API.")
                print("[OK] Live mode: Received structured completion.")
            except Exception as exc:
                global_passed = False
                report_details.append({
                    "fixture": fpath.name,
                    "passed": False,
                    "prompt_rendered": True,
                    "error": str(exc),
                    "failures": ["Live LLM call crashed"]
                })
                print(f"[FAIL] Live LLM call failed: {exc}")
                continue

        # 3. Assertions (Completeness & Correctness)
        # Schema completeness assertions
        if not result.executive_summary or len(result.executive_summary.strip()) < 10:
            failed_assertions.append("Completeness check: executive_summary is missing or too short")
        if not result.architecture_summary or len(result.architecture_summary.strip()) < 10:
            failed_assertions.append("Completeness check: architecture_summary is missing or too short")
        if not result.architecture_style or len(result.architecture_style.strip()) < 2:
            failed_assertions.append("Completeness check: architecture_style is missing or too short")
        if not result.architecture_layers:
            failed_assertions.append("Completeness check: architecture_layers list is empty")
        if not result.repo_insights.strengths:
            failed_assertions.append("Completeness check: strengths insights are empty")

        # Ground-truth baseline assertions
        facts = result.repo_facts
        insights = result.repo_insights

        for key, expected in assertions.items():
            actual = None
            if hasattr(facts, key):
                actual = getattr(facts, key)
            elif hasattr(result, key):
                actual = getattr(result, key)
            elif hasattr(insights, key):
                actual = getattr(insights, key)
            else:
                # check tech_stack arrays
                ts = result.tech_stack
                if key == "primary_language" and ts.languages:
                    actual = ts.languages[0]
                elif key == "primary_framework" and ts.frameworks:
                    actual = ts.frameworks[0]

            if actual != expected:
                failed_assertions.append(f"Verification: Field '{key}' expected '{expected}', got '{actual}'")

        if failed_assertions:
            global_passed = False
            print("[FAIL] Assertion failures detected:")
            for fa in failed_assertions:
                print(f"   - {fa}")
            report_details.append({
                "fixture": fpath.name,
                "passed": False,
                "prompt_rendered": True,
                "failures": failed_assertions
            })
        else:
            print("[OK] All completeness and correctness assertions passed.")
            report_details.append({
                "fixture": fpath.name,
                "passed": True,
                "prompt_rendered": True,
                "failures": []
            })

    # 4. Generate Reports
    eval_dir = Path(__file__).resolve().parent
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    # JSON Report
    json_report = {
        "timestamp": timestamp,
        "mode": args.mode,
        "passed": global_passed,
        "results": report_details
    }
    with open(eval_dir / "report.json", "w", encoding="utf-8") as f:
        json.dump(json_report, f, indent=2)
    print(f"\n[OK] Saved JSON evaluation report to {eval_dir / 'report.json'}")

    # Markdown Report
    md_lines = [
        f"# RepoLens Prompt Evaluation Report",
        f"",
        f"- **Timestamp**: {timestamp}",
        f"- **Mode**: `{args.mode}`",
        f"- **Status**: {'🔴 FAILED' if not global_passed else '🟢 PASSED'}",
        f"",
        f"## Fixture Results",
        f"",
        f"| Fixture | Rendered | Passed | Details / Failures |",
        f"|---|---|---|---|",
    ]
    for r in report_details:
        status_symbol = "🟢" if r["passed"] else "🔴"
        render_symbol = "yes" if r["prompt_rendered"] else "no"
        failures_str = "<br>".join(r.get("failures", [])) or "None"
        if r.get("error"):
            failures_str += f"<br>Error: {r['error']}"
        md_lines.append(f"| {r['fixture']} | {render_symbol} | {status_symbol} | {failures_str} |")

    with open(eval_dir / "report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")
    print(f"[OK] Saved Markdown evaluation report to {eval_dir / 'report.md'}")

    print("=" * 60)
    if global_passed:
        print(" STATUS: ALL PROMPT TESTS PASSED")
        sys.exit(0)
    else:
        print(" STATUS: PROMPT TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    run_evaluation()
