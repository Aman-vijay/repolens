# ADR 0016: GitHub-only auth with custom sign-in flow

**Status:** Accepted  
**Date:** 2026-07-03

## Context

RepoLens is a GitHub repository analysis tool. All users have GitHub accounts and we want a streamlined sign-in experience with a single provider. Clerk's default `<SignIn />` component shows email/password plus any enabled social providers. We want GitHub-only authentication.

## Decision

Replace Clerk's prebuilt `<SignIn />` and `<SignUp />` components with custom pages that use `useSignIn().authenticateWithRedirect()` / `useSignUp().authenticateWithRedirect()` with `strategy: "oauth_github"`.

The flow is:
1. User clicks "Continue with GitHub" on our custom sign-in/sign-up page.
2. Clerk redirects to GitHub for OAuth.
3. GitHub redirects back to `/sso-callback` (our `AuthenticateWithRedirectCallback` page).
4. Clerk processes the callback and redirects to `/dashboard`.

## Why GitHub-only

- RepoLens's core feature is analyzing GitHub repositories. Every user has a GitHub account.
- Reduces sign-in friction to a single click.
- Removes email/password management from our security surface.

## Why custom pages over Clerk Dashboard config

- Clerk Dashboard can disable email/password and enable only GitHub, but the prebuilt `<SignIn />` component still renders with Clerk styling and branding.
- Custom pages give us full control over layout, messaging, and redirect targets.
- The `redirectUrlComplete` parameter gives us reliable routing to `/dashboard`.

## Why an SSO callback page

- `authenticateWithRedirect` requires a route that renders `<AuthenticateWithRedirectCallback />` to handle the OAuth redirect before sending the user to `redirectUrlComplete`.
- Without it, the redirect lands on a blank page.

## Rejected alternatives

- **Prebuilt `<SignIn />` with Clerk Dashboard social-only config**: Less control over UI and redirect behavior.
- **Multiple providers (Google, Email)**: Unnecessary for a GitHub-focused tool.
- **NextAuth.js**: Doesn't integrate with the Clerk backend pipeline already built in M1.

## Consequences

- Users without a GitHub account cannot sign in (by design).
- The sign-in/sign-up pages are "use client" components that use Clerk React hooks.
- We still use Clerk middleware for route protection; only the sign-in UI is custom.
- The `/sso-callback` route is dynamic (server-rendered) because it handles active OAuth state.

## Revisit trigger

- If additional providers are needed → add them to the custom page with their own buttons.
- If Clerk changes the `authenticateWithRedirect` API → update the custom pages.