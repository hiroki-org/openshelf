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
## 2026-05-12 - [Unused CSS Classes]
**Issue:** Added unused css classes to elements not using Tailwind.
**Learning:** React PDF relies on explicit styles and classes instead of built in styled components for certain elements.
**Prevention:** Ensured the right style is applied instead of relying on default standard elements.
## 2026-05-12 - [Unescaped RegExp in Search]
**Issue:** `new RegExp` directly constructed from unescaped user string search query can cause syntax errors when special characters exist.
**Learning:** `new RegExp(query)` can crash if `query` is `.` or `*` or `+`.
**Prevention:** Use an escape string function like `query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` before using inside `RegExp`.
