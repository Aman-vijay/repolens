# ADR 0008: Frontend framework: Next.js 15 App Router + React 19

**Status:** Accepted  
**Date:** 2026-07-03

## Context

RepoLens needs a web frontend that can:

- Render marketing pages statically for fast first paint and cheap hosting.
- Protect authenticated routes and hydrate client-side state after sign-in.
- Call the FastAPI backend with short-lived JWTs without re-implementing auth plumbing.
- Deploy with minimal configuration to the chosen frontend host (Vercel, ADR 0007).

Milestone 1 introduces the first user-facing surfaces (landing, sign-in/up, dashboard) and the first client-to-backend auth flow. The framework decision must support these surfaces today and the richer repository-analysis UI planned for later milestones.

## Decision

Use **Next.js 15 with the App Router** and **React 19**.

- **App Router** for file-system routing, React Server Components (RSC), and colocation of UI and data logic.
- **React 19** because Next.js 15 is built on it and we want to stay on the current stable release line.
- **Server Components by default**; client components declared explicitly with `"use client"`.
- **Clerk integration via `@clerk/nextjs`** (ADR 0009).

## Why Next.js over alternatives

- **Vercel native** (ADR 0007): zero-config builds, preview deployments, and edge-ready middleware.
- **App Router maturity**: RSCs let us keep data-fetching code close to UI without shipping it to the browser, reducing bundle size and request waterfalls.
- **Middleware**: route protection at the edge (e.g., `/dashboard` requires auth) without a round-trip to the backend.
- **Interception / parallel routes** are available later for rich repository-navigation UX without adding another framework.

## Rejected alternatives

- **Remix**: Excellent data-loading patterns, but less native Vercel optimization and no RSC model.
- **Vite + React SPA**: Simpler mental model, but loses SSR/SSG, edge middleware, and Vercel-optimized deployments. Would require more self-built routing and auth guard plumbing.
- **Nuxt / SvelteKit**: Strong frameworks, but introducing a second language/runtime into a team focused on Python/TypeScript backend architecture adds cognitive overhead without clear benefit.

## Consequences

- Must respect the Server/Client Component boundary: Clerk hooks and browser APIs live in client components; data fetching can stay in server components where appropriate.
- React 19 is new enough that some ecosystem libraries may lag; we accept this because Clerk and TanStack Query already support it.
- Bundle and runtime performance are tied to Next.js defaults; we will monitor First Load JS on every build.
- Deployment stays simple: `next build` on Vercel with `outputFileTracingRoot` pointing at the monorepo root.

## Revisit trigger

- If Next.js 15 / React 19 stability issues block delivery → evaluate Remix or a Vite SPA.
- If Vercel pricing or feature constraints become problematic → evaluate self-hosted Next.js or Remix.
- If the app grows heavy client-side interactivity that RSCs cannot express cleanly → re-evaluate the server/client split.
