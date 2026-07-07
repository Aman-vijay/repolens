# Demo Guide — RepoLens

This guide walks through the happy-path demonstration of RepoLens.

## Demo Prerequisites

- Demo repository: A well-documented public GitHub repo (e.g., a FastAPI or Next.js project)
- Prepared questions to ask the chat:
  - "What is the tech stack?"
  - "How does authentication work?"
  - "What are the main entry points?"
- Prepared feature request for planner:
  - "Add rate limiting to the API endpoints"
  - "Implement dark mode support"

## Demo Script

### 1. Introduction (30 seconds)

> "RepoLens helps engineers understand unfamiliar codebases. Instead of spending hours reading code and documentation, you can ask questions and get answers grounded in the actual repository code.
>
> Let me show you a complete walkthrough: creating a project, analyzing a repository, searching for code, chatting about the codebase, and generating an implementation plan."

### 2. Create Project (30 seconds)

1. Navigate to dashboard (or empty state)
2. Click "New Project"
3. Enter project name: "FastAPI Demo"
4. Enter description: "FastAPI reference application"
5. Click "Create Project"
6. Redirect to project detail page

**Verification**: Project appears in the project list with correct name.

### 3. Import Repository (1 minute)

1. Click "Import Repository"
2. Paste GitHub URL: `https://github.com/tiangolo/fastapi`
3. Click "Attach"
4. Observe status changes: `pending` → `cloning` → `indexing` → `analyzing` → `ready`

**While waiting, explain**:
> "Behind the scenes, we're cloning the repository, chunking the files, generating embeddings, and running AI analysis. This typically takes 15-30 seconds for a small repo."

**Verification**: Status shows `ready`, file tree appears, analysis summary is displayed.

### 4. Review Analysis (30 seconds)

1. Show the executive summary section
2. Point out the tech stack (FastAPI, Python, Pydantic)
3. Highlight the entry points
4. Show the file tree navigation

**Verification**: Summary correctly identifies FastAPI as the framework.

### 5. Semantic Search (45 seconds)

1. Open the search panel
2. Type: "How is authentication implemented?"
3. Show results with file paths and code snippets
4. Click on a result to see the full chunk

**Verification**: Search returns relevant results, not just filename matches.

### 6. Codebase Chat (1 minute)

1. Open the chat panel
2. Ask: "What is the main entry point and how does the application start?"
3. Show the streaming response
4. Ask follow-up: "Show me the middleware setup"
5. Show how the AI cites specific files and line numbers

**Verification**: Response is grounded in actual code, not hallucinated.

### 7. Implementation Planner (1 minute)

1. Open the Planner panel
2. Enter feature request: "Add rate limiting to all API endpoints"
3. Show plan generation progress
4. Review the generated plan:
   - Checklist structure
   - Steps with descriptions
   - Confidence indicators
   - File references

5. Refine the plan:
   - "Make the rate limits configurable via environment variables"
   - Show updated plan with new steps

**Verification**: Plan follows the JSON schema, includes checklists, steps, files, confidence, and reasoning.

### 8. Clean Up (15 seconds)

1. Delete the demo project
2. Confirm deletion in modal

---

## Demo Tips

### Do

- **Prepare a local repo copy** for demos without internet
- **Use a well-known repo** (FastAPI, Next.js) so audience recognizes it
- **Have backup questions** ready if live demo goes wrong
- **Show the "thinking" indicators** to build confidence in the AI

### Don't

- **Don't demo with a broken or empty repo** - analysis will fail
- **Don't skip the error cases** - show how the system handles problems
- **Don't rush** - the value is in showing the AI grounding the responses in actual code

---

## Troubleshooting Demo Issues

| Problem | Solution |
|---------|----------|
| Clone fails | Check internet connection, use a simpler repo |
| Analysis stuck | Verify OpenAI API key is set |
| Chat not responding | Check API server logs |
| Plan not generating | Verify analysis completed successfully |

---

## Post-Demo Talking Points

1. **Security**: All data is isolated per user
2. **Privacy**: We never store repository code longer than needed
3. **Accuracy**: Grounding prevents AI hallucinations
4. **Extensibility**: Planner outputs structured JSON for integration
