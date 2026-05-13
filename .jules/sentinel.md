## 2024-05-08 - SQL Injection in Like Queries
**Vulnerability:** In drizzle ORM, the `like` helper doesn't automatically escape wildcards, which can lead to algorithmic complexity DoS via wildcard injection.
**Learning:** Found in `apps/api/src/routes/users.ts` using `like(users.name, \`%\${q}%\`)` directly with user query.
**Prevention:** Use `sql` template literals with an `ESCAPE` clause and an escape function for literal wildcard characters instead of the built-in `like` helper when handling user input.

## 2024-05-18 - [Wildcard Injection via Drizzle like()]
**Vulnerability:** Drizzle ORM's `like()` function used in `apps/api/src/routes/users.ts` without escaping wildcards.
**Learning:** `like()` in Drizzle does not automatically escape `%` and `_` characters. User input passed directly to `like()` allows for wildcard injection, which could lead to algorithmic complexity Denial of Service (DoS) attacks.
**Prevention:** Always manually escape wildcard characters in user input before passing it to SQL queries when using Drizzle, or use `sql` templates with explicit `ESCAPE` clauses.

## 2024-05-18 - OAuth Open Redirect via Weak Origin Validation
**Vulnerability:** A wildcard in the `ALLOWED_ORIGINS` configuration allows the CORS and CSRF/OAuth flow to accept any client-provided origin, leading to a bypass in origin verification and an open redirect where tokens can be stolen.
**Learning:** Utilities that resolve or validate origins against a configurable list should explicitly reject wildcard patterns in sensitive flows such as OAuth redirects or CORS responses, ensuring wildcards only apply when strictly intended by the configuration.
**Prevention:** Pass `{ allowWildcard: false }` to the `isAllowedOrigin` helper in all places where sensitive token delivery relies on frontend URLs.
## 2026-05-11 - [Catching String Rejections]
**Issue:** String exceptions were not handled, causing the app to return an Internal Server Error.
**Learning:** `e instanceof Error` correctly identifies built-in errors, but doesn't handle `throw "error"`. It caused Hono to not correctly propagate a 500 status.
**Prevention:** Handled by validating `e instanceof Error ? e.message : typeof e === 'string' ? e : "";` and throwing an error properly at the end `throw e instanceof Error ? e : new Error(String(e));`.
## 2026-05-12 - [Centralize SQL LIKE Wildcard Escaping]
**Vulnerability:** Drizzle ORM's `like` helper and raw `LIKE` queries were scattered across multiple files with inconsistent or duplicated escaping logic for wildcards (`%` and `_`).
**Learning:** Inconsistent escaping of user input in SQL `LIKE` clauses can lead to algorithmic complexity DoS attacks via wildcard injection. Centralizing the escaping logic ensures consistent application across all route files and prevents future regressions.
**Prevention:** Create a shared utility function (`escapeLikeLiteral`) for escaping literal wildcard characters and use it consistently for all `LIKE` queries involving user input.
## 2026-05-12 - [DoS via Overly Long Search Queries]
**Vulnerability:** Autocomplete/search endpoints (like `/api/tags/suggest`) accepted arbitrarily long query strings, potentially causing excessive DB load or regex evaluation delays.
**Learning:** Endpoints that perform text processing, regex replacements, or SQL `LIKE` queries should restrict the length of user inputs to mitigate Denial of Service (DoS) risks, instead of implicitly trusting the frontend input limits.
**Prevention:** Implement server-side length validation using named constants (e.g., `TAG_SUGGEST_MAX_QUERY_LENGTH = 100`) and return a `400 Bad Request` early in the flow if the query exceeds safe bounds.
