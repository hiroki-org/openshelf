---
description: "OpenShelf – Research artifact hosting platform. Monorepo with Next.js 16 frontend, Hono/Cloudflare Workers API, Drizzle ORM + D1, Playwright E2E tests."
applyTo: "**"
---

# OpenShelf – Copilot Instructions

**OpenShelf** is a research artifact hosting and sharing platform where users authenticate with GitHub OAuth to upload and share research outputs (papers, slides, datasets). The stack is a TypeScript monorepo deployed on Cloudflare's edge platform.

## Quick Reference

| Component    | Tech                                 | Location                    |
| ------------ | ------------------------------------ | --------------------------- |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 | `apps/web`                  |
| **Backend**  | Hono 4, Cloudflare Workers           | `apps/api`                  |
| **Database** | SQLite (Cloudflare D1) + Drizzle ORM | `apps/api/src/db/schema.ts` |
| **Storage**  | Cloudflare R2                        | File uploads                |
| **Auth**     | GitHub OAuth 2.0 → JWT (HS256)       | 7-day expiry                |
| **Testing**  | Vitest (unit), Playwright (E2E)      | `apps/e2e`                  |

---

## Getting Started

### Environment Setup

**API** (`apps/api/.dev.vars`):

```env
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
JWT_SECRET=dev-secret-change-in-prod
FRONTEND_URL=http://localhost:3000
ENABLE_TEST_AUTH=true  # For E2E tests only (disable in prod)
```

**Web** (`apps/web/.env.local`):

```env
API_URL=http://localhost:8787
NEXT_PUBLIC_API_URL=http://localhost:8787
```

### Core Commands

```bash
# Root-level commands (run across all workspaces)
npm run test              # Run Vitest suite (unit + component tests)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run typecheck        # tsc --noEmit all apps
npm run lint             # ESLint on apps/*/src

# API (apps/api)
npm run dev                    # Start wrangler dev server (staging env, port 8787)
npm run db:generate           # Generate Drizzle migration
npm run db:migrate:local      # Apply migrations to local D1 (staging env)
npm run db:migrate:remote     # Apply migrations to Cloudflare D1 (production env)

# Web (apps/web)
npm run dev       # Start Next.js dev server (port 3000)
npm run build     # Build for production
npm run lint      # ESLint

# E2E (apps/e2e)
npm run test      # Playwright test (auto-starts both servers)
npm run test:ui   # Open Playwright Inspector UI
```

---

## Architecture & Key Concepts

### Monorepo Structure

```
apps/
├── api/       Cloudflare Workers + Hono backend
├── web/       Next.js 16 (App Router) frontend
└── e2e/       Playwright integration tests
```

### API Routes

**Location**: `apps/api/src/routes/<resource>.ts`

Routes are registered in `apps/api/src/index.ts` using Hono's routing. Example:

```ts
app.get("/papers", authMiddleware, listPapersHandler);
app.post("/papers", authMiddleware, createPaperHandler);
```

All protected routes require `authMiddleware` from `apps/api/src/middleware/auth.ts`, which validates the Bearer JWT token and sets `c.set("user", userPayload)`.

### Authentication Flow

1. User clicks "Sign in with GitHub" → redirects to `/api/auth/github`
2. GitHub OAuth callback → `/api/auth/github/callback` → upsert user in D1 → return JWT
3. Client stores JWT in `localStorage` (key: `auth_token`)
4. Subsequent API requests include `Authorization: Bearer <jwt>` header
5. Frontend `useAuth()` hook (via `AuthProvider`) manages `{ user, loading, login(), logout(), refresh() }`

**JWT Details**: HS256, 7-day expiry, signed with `JWT_SECRET`

### Database Schema (Drizzle ORM + D1)

**Location**: `apps/api/src/db/schema.ts`

**Key Tables**:

- `users` – Basic user info + GitHub account mapping
- `papers` – Research artifacts with visibility levels (`public | org_only | private`)
- `paperAuthors` – Junction: tracks uploader and coauthor roles
- `orgs` – Organization/team containers
- `orgMembers` – Junction: tracks member roles (owner, admin, member)
- `collections` – User-organized paper collections
- `collectionPapers` – Junction table
- `coauthorInvites` – Pending/accepted/declined invitations

**Conventions**: DB columns are `snake_case` in SQL; Drizzle auto-maps to `camelCase` in JS objects.

**Migrations**: After schema changes, run:

```bash
npm run db:generate    # Create migration file
npm run db:migrate:local   # Test locally
```

### File Handling

**Validation** (`apps/api/src/utils/file.ts`):

- Magic-number checks (PDF, PNG, JPEG, PPT, PPTX)
- 50 MB size limit
- Uploaded to Cloudflare R2; metadata + `r2Key` stored in D1

**File Types**: `"paper" | "slides" | "poster" | "supplementary"`

### Paper Visibility & Access Control

Papers have three visibility levels:

- `public` – Anyone can view
- `org_only` – Only org members
- `private` – Uploader + coauthors only

**Enforcement**: `authorizePaperAccess()` in `apps/api/src/routes/papers.ts`

---

## Code Conventions

### TypeScript & Naming

- **File names**: kebab-case (e.g., `auth-provider.tsx`, `paper-detail-client.tsx`)
- **React components**: PascalCase exports
- **DB schema**: `snake_case` columns in SQL
- **Target**: ES2022 (API), ES2017 (Web)

### Error Handling

API errors **always** return JSON:

```json
{ "error": "Descriptive message" }
```

with appropriate HTTP status codes. Never return bare strings.

### Input Validation

**Slug format regex**: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/`

All user-supplied strings must have explicit length bounds checked before DB writes.

### Next.js Client/Server Patterns

- Pages requiring auth or state → mark `"use client"`
- Server components for content that doesn't need client state
- `apiFetch()` helper in `apps/web/src/lib/api.ts` auto-attaches JWT header

### CSRF Protection

API middleware blocks non-GET requests without both:

- Matching `Origin`/`Referer` header, **OR**
- Bearer token (JWT)

This protects against CSRF in cookie-less JWT flows.

### E2E Test Authentication

Tests skip real GitHub OAuth by using `/api/auth/test-token` (enabled when `ENABLE_TEST_AUTH=true`).

**Location**: `apps/e2e/helpers/auth.ts` → `loginAsTestUser()`

⚠️ **Never enable `ENABLE_TEST_AUTH` in production.**

---

## Cloudflare Bindings (Runtime Env)

| Binding           | Type   | Purpose                      |
| ----------------- | ------ | ---------------------------- |
| `DB`              | D1     | SQLite database              |
| `BUCKET`          | R2     | File storage (R2)            |
| `JWT_SECRET`      | Secret | JWT signing key              |
| `ALLOWED_ORIGINS` | Var    | Comma-separated CORS origins |

Defined in `apps/api/wrangler.toml` and accessed in handlers via `c.env.DB`, `c.env.BUCKET`, etc.

`apps/api/wrangler.toml` defines both `[env.staging]` and `[env.production]` bindings. Always pass `--env staging` or `--env production` for Wrangler commands that require bindings (for example, `wrangler dev`, `wrangler deploy`, and `wrangler d1 migrations apply`). Running Wrangler commands without an explicit environment will fail because no top-level bindings are defined.

---

## Agent Workflow Guidelines

### When Starting New Work

#### New Feature or Task

1. Create a new feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Implement changes and write tests
3. Run validation before pushing:
   ```bash
   npm run typecheck && npm run test && npm run lint
   ```
4. Push branch and open a Pull Request on GitHub
5. Wait for CI to complete (observe via `gh pr checks`)

#### Existing Feature (Non-Destructive Changes)

1. Check out the feature branch:
   ```bash
   git checkout feature/existing-feature-name
   ```
2. Make improvements and commit
3. Push and follow PR review cycle (see below)

### Test-First Development

- **Unit tests**: Write tests in `src/**/__tests__/**/*.test.ts{,x}` alongside source
- **Integration tests**: Use Playwright in `apps/e2e/tests/`
- **Run tests**: `npm run test` (root) or `npm run test:watch`

### Type Safety

Run `npm run typecheck` before committing to catch TS errors.

---

### Responding to PR Reviews

**Overview:** For each PR review comment, you must reply via GitHub's conversation API, resolve the thread, and verify all conversations are addressed before merging.

**Detailed Workflow:**

1. **Fetch and review all conversations**

   ```bash
   gh pr view <PR#> --json reviews
   ```

2. **For each conversation thread**, choose one of two paths:

   **Path A: Accepting the suggestion**
   - Apply the change to your branch and commit:
     ```bash
     # Make edits, then:
     git add .
     git commit -m "Address review: <subject>"
     git push
     ```
   - Reply to the conversation explaining the fix:
     ```bash
     gh pr comment <PR#> --body "✅ Applied in commit $(git rev-parse --short HEAD). Changes: <brief description>"
     ```
   - Mark as resolved on GitHub (via web UI or after approval)

   **Path B: Declining or deferring**
   - Reply with justification:
     ```bash
     gh pr comment <PR#> --body "⚠️ Deferred for future work because: <reason>. Tracked in #XYZ"
     ```
   - Resolve the conversation (indicate it won't be addressed in this PR)

3. **Verify all conversations are resolved**

   ```bash
   # Check for unresolved review threads
   gh pr view <PR#> --json reviews | grep -i "pending\|unresolved"
   ```

   Status should be empty (no pending reviews).

4. **Check CI status**

   ```bash
   gh pr checks <PR#>
   ```

   - **All passing?** → Proceed to merge
   - **Any failing?** → Investigate and fix:
     ```bash
     gh pr checks <PR#> --watch  # Real-time logs
     ```

5. **Final approval and merge**

   ```bash
   # Wait for any last-minute feedback
   sleep 300 && gh pr checks <PR#>

   # If all checks pass and reviews approved:
   gh pr merge <PR#> --squash --delete-branch
   ```

**Conversation Checklist:**

- ☐ All comments have a reply (accept or defer)
- ☐ All accepted changes are committed and pushed
- ☐ All deferred changes reference a tracking issue
- ☐ All threads marked as resolved on GitHub
- ☐ CI checks are passing
- ☐ Code review approval(s) received

**Example Command Sequence:**

```bash
# Check PR status
gh pr view 42

# Wait and re-check CI after making changes
sleep 300 && gh pr checks 42

# Watch CI in real-time
gh pr checks 42 --watch

# Once ready, merge
gh pr merge 42 --squash
```

---

## Useful Paths & Entry Points

| Purpose            | Path                                        |
| ------------------ | ------------------------------------------- |
| API entry          | `apps/api/src/index.ts`                     |
| API routes         | `apps/api/src/routes/*.ts`                  |
| API middleware     | `apps/api/src/middleware/auth.ts`           |
| DB schema          | `apps/api/src/db/schema.ts`                 |
| Web root layout    | `apps/web/src/app/layout.tsx`               |
| Web API client lib | `apps/web/src/lib/api.ts`                   |
| Auth provider      | `apps/web/src/components/auth-provider.tsx` |
| E2E tests          | `apps/e2e/tests/*.spec.ts`                  |
| E2E helpers        | `apps/e2e/helpers/*.ts`                     |

---

## Common Tasks

### Add a New API Endpoint

1. Create handler in `apps/api/src/routes/<resource>.ts` (or new file)
2. Use `authMiddleware` for protected routes
3. Return `{ error: "..." }` on errors with proper status code
4. Register route in `apps/api/src/index.ts`
5. Add E2E test in `apps/e2e/tests/*.spec.ts`

### Update Database Schema

1. Modify `apps/api/src/db/schema.ts`
2. Run `npm run db:generate`
3. Review the generated migration in `apps/api/drizzle/`
4. Test with `npm run db:migrate:local`
5. Deploy with `npm run db:migrate:remote`

### Add Frontend Component

1. Create component in `apps/web/src/components/` (kebab-case filename)
2. Use `"use client"` if it needs interactivity or auth context
3. Add tests in `apps/web/src/components/__tests__/`
4. Import API via `apiFetch()` helper if needed

### Run End-to-End Tests

```bash
cd apps/e2e
npm run test          # Headless
npm run test:ui       # Interactive Inspector
```

Tests auto-start both frontend (port 3000) and API (port 8787).

---

## Deployment

- **Frontend**: Vercel or Docker (see `apps/web/Dockerfile`)
- **API**: Cloudflare Workers via `wrangler deploy`
- **Database migrations**: Apply via `npm run db:migrate:remote`

See `apps/web/README.md` and `apps/api/wrangler.toml` for environment variable requirements.

---

## Additional Resources

- [Hono Docs](https://hono.dev/) – Framework used in API
- [Next.js Docs](https://nextjs.org/docs) – Frontend framework
- [Drizzle ORM](https://orm.drizzle.team/) – Database ORM
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Playwright Docs](https://playwright.dev/) – E2E testing
- [instruction.md](../../instruction.md) – Original project guide (superceded by this file)

---

## Notes for Agents

- Always check `.github/copilot-instructions.md` **first** for project-specific conventions.
- Use `npm run typecheck` and `npm run test` to validate changes before pushing.
- E2E tests require both `apps/api` and `apps/web` running; Playwright auto-starts them.
- For database changes, test locally with `db:migrate:local` before planning remote migrations.
- Keep JWT secret and GitHub OAuth credentials secure; use environment variables.

### PR Workflow Reminders

- **New features:** Always create a feature branch and open a PR; never commit directly to `main`.
- **PR reviews:** Reply to _each_ conversation thread on GitHub; unresolved threads block merging.
- **CI failures:** Investigate immediately via `gh pr checks <PR#> --watch` and fix before re-requesting review.
- **Merge readiness checklist:** All conversations resolved + all CI passing + approval received = safe to merge.
- **Use `sleep` + recheck pattern:** `sleep 300 && gh pr checks <PR#>` to let CI run before final checks.
