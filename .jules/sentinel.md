## 2024-05-18 - [Wildcard Injection via Drizzle like()]
**Vulnerability:** Drizzle ORM's `like()` function used in `apps/api/src/routes/users.ts` without escaping wildcards.
**Learning:** `like()` in Drizzle does not automatically escape `%` and `_` characters. User input passed directly to `like()` allows for wildcard injection, which could lead to algorithmic complexity Denial of Service (DoS) attacks.
**Prevention:** Always manually escape wildcard characters in user input before passing it to SQL queries when using Drizzle, or use `sql` templates with explicit `ESCAPE` clauses.

## 2024-05-18 - OAuth Open Redirect via Weak Origin Validation
**Vulnerability:** A wildcard in the `ALLOWED_ORIGINS` configuration allows the CORS and OAuth flow to accept any client-provided origin, leading to a bypass in origin verification and an open redirect where tokens can be stolen.
**Learning:** Utilities that resolve or validate origins against a configurable list should explicitly reject wildcard patterns in sensitive flows such as OAuth redirects or CORS responses, ensuring wildcards only apply when strictly intended by the configuration.
**Prevention:** Pass `{ allowWildcard: false }` to the `isAllowedOrigin` helper in all places where sensitive token delivery relies on frontend URLs.
