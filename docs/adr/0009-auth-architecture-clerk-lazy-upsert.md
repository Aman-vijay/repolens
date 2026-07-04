# ADR 0009: Auth architecture: Clerk + lazy idempotent user upsert

**Status:** Accepted  
**Date:** 2026-07-03

## Context

RepoLens must identify users, protect API routes, and keep a local `users` table in sync so that projects and other entities can have foreign-key relationships to a user row. We do not want to build or operate our own identity provider.

The auth system must:

- Issue and verify short-lived JWTs from a trusted provider.
- Create a corresponding row in our Postgres `users` table.
- Tolerate race conditions between the webhook that creates the user and the first API call that references them.

## Decision

Use **Clerk** as the identity provider and implement a **dual-path user creation strategy**:

1. **Primary path — Clerk webhook.** On `user.created`, a verified webhook handler inserts the user into the `users` table.
2. **Fallback path — lazy idempotent upsert.** The FastAPI `get_current_user` dependency verifies the JWT with the official Clerk Python SDK (`clerk-backend-api`) and runs `INSERT ... ON CONFLICT DO NOTHING` so the first authenticated API call also safely creates the row if the webhook has not arrived yet.

## Why Clerk

- Managed auth with first-class Next.js SDK (`@clerk/nextjs`) and official Python SDK (`clerk-backend-api`).
- Handles sign-up, sign-in, email verification, password reset, MFA, and organizations if we need them later.
- Webhook events for user lifecycle keep our database in sync without polling.

## Why lazy upsert as fallback

- Webhooks can be delayed, lost, or retried. Relying on them alone creates a race where a signed-in user hits the dashboard before the `users` row exists.
- `INSERT ... ON CONFLICT DO NOTHING` is idempotent and cheap; it makes the system self-healing without retry logic.
- Reads after the upsert always return the row, so downstream foreign keys work.

## Why the official Clerk Python SDK

- Manages JWKS caching, token validation, and SDK updates for us.
- Rejected manual JWKS parsing because it is error-prone and duplicates work Clerk already does.

## Rejected alternatives

- **Supabase Auth**: Tight coupling to Supabase ecosystem; less flexible for our chosen managed stack.
- **Auth0**: More expensive at scale and more configuration surface than Clerk.
- **NextAuth.js / Auth.js**: Requires a database adapter and more custom integration; Clerk is simpler for this stack.
- **Manual JWT verification with raw JWKS**: Avoided — repeated work, higher bug surface, no caching support.

## Consequences

- Auth is an external dependency with pricing implications; acceptable for a demonstration project.
- The `users` table is intentionally thin (Clerk owns profile data; we own IDs and foreign keys).
- Every authenticated request touches the database for the upsert/read; mitigated by index on `clerk_id`.
- Webhook verification uses the svix SDK and `CLERK_WEBHOOK_SECRET`.

## Revisit trigger

- If Clerk pricing or feature limits become restrictive → evaluate Supabase Auth or Auth0.
- If webhook reliability becomes a real problem → add a reconciliation job that backfills missing users from Clerk's API.
- If we need richer profile data locally → expand the `users` model while keeping Clerk as the source of truth.
