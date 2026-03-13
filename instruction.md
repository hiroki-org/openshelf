# OpenShelf – Copilot Instructions

## Project Overview

OpenShelf is a research artifact hosting and sharing platform. Users authenticate with GitHub OAuth and upload/share research outputs (papers, slides, posters, datasets). The stack is a TypeScript monorepo targeting Cloudflare's edge platform.

- **Backend**: Hono 4 on Cloudflare Workers, SQLite via Cloudflare D1, files in Cloudflare R2
- **Frontend**: Next.js 15 (App Router) with React 19, Tailwind CSS 4
- **Auth**: GitHub OAuth 2.0 → JWT (HS256, 7-day expiry), stored in `localStorage`
- **E2E Tests**: Playwright auto-starts both servers and uses a special test-auth endpoint

---

## Commands

### Root (runs across all workspaces)
```bash
npm run test            # Vitest unit tests
npm run test:watch      # Watch mode
npm run typecheck       # tsc --noEmit across all workspaces
npm run lint            # ESLint across apps/*/src
```

### Single test (from root or inside an app)
```bash
# API
cd apps/api && npx vitest run src/routes/__tests__/papers.test.ts

# Web
cd apps/web && npx vitest run src/components/__tests__/SomeComponent.test.tsx
```

### API (`apps/api`)
```bash
npm run dev                     # wrangler dev
npm run db:generate             # Generate Drizzle migration
npm run db:migrate:local        # Apply migrations to local D1
npm run db:migrate:remote       # Apply migrations to Cloudflare D1
```

### Web (`apps/web`)
```bash
npm run dev     # next dev
npm run build   # next build
npm run lint    # eslint
```

### E2E (`apps/e2e`)
```bash
npm run test       # playwright test (requires both servers running)
npm run test:ui    # Playwright UI mode
```

---

## Architecture

### Monorepo Structure
```
apps/api/   → Cloudflare Workers API (Hono)
apps/web/   → Next.js frontend
apps/e2e/   → Playwright tests
```

### API Route Layout
Each resource lives in `apps/api/src/routes/<resource>.ts`. Routes are mounted in `apps/api/src/index.ts`. All protected routes use `authMiddleware` from `middleware/auth.ts`, which validates the Bearer JWT and sets `c.set("user", payload)`.

### Authentication Flow
1. Frontend redirects to `/api/auth/github` → GitHub OAuth
2. Callback at `/api/auth/github/callback` → upsert user in D1 → return JWT
3. Client stores JWT in `localStorage` (`auth_token`)
4. Frontend sends `Authorization: Bearer <jwt>` on every API request
5. `useAuth()` hook (via `AuthProvider`) exposes `{ user, loading, login(), logout(), refresh() }`

### Database (Drizzle ORM + D1)
Schema is in `apps/api/src/db/schema.ts`. Key tables:
- `users`, `papers`, `paperAuthors` (junction: uploader / coauthor roles)
- `orgs`, `orgMembers` (owner / admin / member roles)
- `collections`, `collectionPapers`
- `coauthorInvites` (pending / accepted / declined)

Migrations live in `apps/api/drizzle/`. Run `db:generate` after changing schema, then `db:migrate:local`.

### File Handling
- Files upload to R2; metadata (including `r2Key`) stored in D1
- Validation in `apps/api/src/utils/file.ts`: magic-number checks, 50 MB limit, allowed types: PDF / PNG / JPEG / PPT / PPTX
- File `fileType` enum: `"paper" | "slides" | "poster" | "supplementary"`

### Paper Visibility & Access Control
```ts
visibility: "public" | "org_only" | "private"
```
`authorizePaperAccess()` in `apps/api/src/routes/papers.ts` enforces:
- `public` → anyone
- `org_only` → org members
- `private` → uploader + coauthors only

---

## Key Conventions

### TypeScript
- All files use `kebab-case` names (e.g., `auth-provider.tsx`, `paper-detail-client.tsx`)
- React components: PascalCase exports
- DB columns: `snake_case` in SQL, which Drizzle automatically maps to `camelCase` properties on objects.

### Error Responses
API errors always return `{ error: "message" }` JSON with an appropriate HTTP status code. Never return bare strings.

### Input Validation
- Slug format: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/`
- All user-supplied strings have explicit length bounds checked before DB writes

### Next.js Client/Server Split
Pages that require auth or interactivity are marked `"use client"`. Server components are used where no client state is needed. The `apiFetch()` helper in `apps/web/src/lib/api.ts` automatically attaches the auth header.

### CSRF Protection
The API middleware blocks non-GET requests that lack either a matching Origin/Referer or a Bearer token, providing CSRF protection for cookie-less JWT flows.

### E2E Test Auth
E2E tests skip real GitHub OAuth by calling `/api/auth/test-token` (only active when `ENABLE_TEST_AUTH=true`). The `loginAsTestUser()` helper in `apps/e2e/helpers/auth.ts` handles this. Never enable `ENABLE_TEST_AUTH` in production.

### Cloudflare Bindings (API env)
| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 | SQLite database |
| `BUCKET` | R2 | File storage |
| `JWT_SECRET` | Secret | JWT signing |
| `ALLOWED_ORIGINS` | Var | Comma-separated CORS origins |

## Agent Workflow Guidelines

When you receive instructions, follow these guidelines based on the context:

- **New Feature or Task**: Create a new branch from the default branch and open a Pull Request.
- **Improving an Existing PR/Branch**: Checkout the existing feature branch and push your changes.

 - If ignoring a suggestion, reply with a clear reason why it is being skipped, and resolve the conversation.
 - Ensure that the number of unresolved conversations (`isResolved: false`) is strictly 0.

### Pull Request Reviews
When responding to PR reviews using the `gh` CLI:
- Always reply to and resolve the GitHub conversation for each comment.
- If accepting a suggestion, apply the change, reply with the commit details explaining how it was addressed, and resolve the conversation.
- If ignoring a suggestion, reply with a clear reason why it is being skipped, and resolve the conversation.
- If a suggestion is implemented with an alternative approach, explain the implementation and the reasoning before resolving the conversation.
- Ensure that the number of unresolved conversations (`isResolved: false`) is strictly 0.

### CI Status
- If CI is configured, check its status.
- If CI succeeds, proceed.
- If CI fails, check the failure details and address the issues.

### Language Requirement
When interacting on GitHub (e.g., PR descriptions, PR comments, replies), always use Japanese. This applies strictly to GitHub interactions, not to code implementation, variable names, or inline code messages.
