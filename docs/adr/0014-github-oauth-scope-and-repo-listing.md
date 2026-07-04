# ADR 0014: GitHub OAuth scope and repo listing via Clerk Backend API

**Status:** Accepted  
**Date:** 2026-07-03

## Context

Users want to import repositories from their GitHub account instead of pasting URLs. To list their/public repos, we need a GitHub OAuth access token with the `public_repo` scope.

## Decision

1. Configure the `public_repo` scope in the Clerk Dashboard for the GitHub social connection.
2. Backend retrieves the stored OAuth token via `clerk.users.get_o_auth_access_token(user_id, provider="oauth_github")`.
3. Backend calls `GET https://api.github.com/user/repos` with the token as `Authorization: Bearer` and returns a simplified list to the frontend.

## Why `public_repo` (not `repo`)

- `public_repo` grants read access to public repos only.
- Lower consent friction: users see a simpler GitHub permission screen.
- Sufficient for importing public repositories into RepoLens.

## Why a backend proxy

- The GitHub OAuth token stored by Clerk is a secret; exposing it to the browser is unsafe.
- The backend can add rate limiting, caching, and filtering before sending the list to the client.

## Flow

```
Browser → GET /api/github/repos → get Clerk token → GitHub API → list of repos → JSON
```

## Rejected alternatives

- **Store GitHub token ourselves**: Duplicates Clerk's responsibility and adds credential management.
- **Client-side GitHub calls**: Exposes the OAuth token to the browser.
- **`repo` scope (all repos)**: Overkill for public-repo focus; scary consent screen.

## Consequences

- Users must sign in AFTER the scope is configured in Clerk, or they won't have the token.
- If a user hasn't connected GitHub to Clerk, `/api/github/repos` returns an empty list.
- Rate limits inherit GitHub API limits (5000/hour with token, 60/hour without).

## Revisit trigger

- If users want private-repo import → upgrade to `repo` scope and re-auth.
- If we need more GitHub metadata (topics, PRs, issues) → add additional scopes.
- If rate limits become a problem → add caching via Upstash Redis.