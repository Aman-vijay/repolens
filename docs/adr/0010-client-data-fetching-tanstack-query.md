# ADR 0010: Client data fetching: TanStack Query

**Status:** Accepted  
**Date:** 2026-07-03

## Context

The RepoLens dashboard and future repository-analysis UI make authenticated HTTP calls to the FastAPI backend. We need a client-side data-fetching layer that handles:

- Request deduplication across components.
- Caching, background refetching, and stale-while-revalidate behavior.
- Loading, error, and empty states for queries and mutations.
- Cache invalidation after mutations (e.g., creating a project refreshes the project list).

## Decision

Use **TanStack Query v5** (`@tanstack/react-query`) for all client-side data fetching.

- Wrap the app in `QueryClientProvider` with a configured `QueryClient`.
- Encapsulate data access in `lib/api.ts` (typed fetch wrappers) and `lib/queries.ts` (query/mutation hooks).
- Fetch the Clerk JWT inside the hook via `useAuth().getToken()` and pass it to the fetch wrapper.

## Why TanStack Query

- De-facto standard for React server-state management.
- Automatic deduplication when multiple components use the same query key.
- First-class mutation support with `onSuccess` cache invalidation.
- Small API surface; no global state boilerplate for server data.

## Rejected alternatives

- **SWR**: Very similar to TanStack Query. TanStack Query was chosen because of richer mutation/invalidation APIs and broader ecosystem alignment.
- **Apollo Client**: Designed for GraphQL; overkill for a REST backend.
- **RTK Query**: Tightly coupled to Redux; would introduce global state complexity we don't need.
- **Raw `fetch` + `useEffect`**: Requires re-implementing dedup, caching, loading states, and error handling.

## Consequences

- Server state (fetched data) is cleanly separated from client state (forms, UI toggles).
- All API calls go through typed hooks, making refactors safer.
- Auth token is fetched lazily per request, so token rotation is handled automatically.
- TanStack Query Devtools can be added later for debugging.

## Revisit trigger

- If we move to a GraphQL API → evaluate Apollo Client or Relay.
- If TanStack Query v6 introduces breaking changes incompatible with our hooks → plan migration.
- If we adopt React Server Components for most data fetching → reduce TanStack Query usage to client-only interactions.
