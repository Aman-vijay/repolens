# ADR 0015: Superadmin via is_superuser column and env-var seed

**Status:** Accepted  
**Date:** 2026-07-03

## Context

RepoLens needs a superadmin dashboard for system-wide visibility (all users, all projects, repository status). We need a simple, reliable way to designate the first superadmin without a full RBAC system.

## Decision

1. Add an `is_superuser` boolean column to the `users` table (default `false`).
2. Seed the first superadmin via an environment variable `SUPERADMIN_CLERK_USER_ID`. The Clerk webhook handler and the lazy upsert dependency both check this value on user creation and set `is_superuser=true`.
3. Backend authorization: `get_current_superuser` dep returns 403 if `is_superuser` is false.
4. Frontend: `/admin` routes are auth-protected at the middleware level (must be signed in) and superuser-checked at the API level (backend returns 403 for non-superusers).

## Why a boolean column

- One superadmin dashboard doesn't justify a full roles-and-permissions system.
- Boolean on `users` is trivially queryable and indexable.
- We can add an `admin_users` table or Clerk Organizations later if multi-role RBAC is needed.

## Why an env-var seed

- No DB access required; the user sets `SUPERADMIN_CLERK_USER_ID=user_xxx` in `.env`.
- Both webhook creation and lazy upsert check it, so the flag is set regardless of which path creates the user.
- To add/remove superadmins, change the env var and re-sign-in, or update the DB directly.

## Rejected alternatives

- **Hardcode a Clerk user ID**: Not portable; different in dev vs prod.
- **Clerk Organizations with admin role**: Overkill for one superadmin; adds Clerk configuration complexity.
- **JWT claim-based**: Requires custom Clerk JWT template modifications.

## Consequences

- The first superadmin must be designated before signing in, or the flag won't be set on creation.
- Changing superadmin after sign-up requires re-signing-in or a manual SQL update.
- `is_superuser` is not exposed in the JWT; it's checked on the server via the database.

## Revisit trigger

- If multiple admins are needed → add an `admin_users` mapping table.
- If role-based access control is needed → implement a roles table or use Clerk Organizations.
- If we add tenant/org awareness → replace `is_superuser` with org-level roles.