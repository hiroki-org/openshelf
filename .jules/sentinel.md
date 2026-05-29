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
**Prevention:** Handle unknown thrown values by deriving a safe message for comparisons and always re-throwing an `Error` object, for example `throw e instanceof Error ? e : new Error(message);`.
## 2026-05-15 - [IPスプーフィングの脆弱性]
**Vulnerability:** X-Forwarded-For ヘッダーを使用した IP アドレスのフォールバック
**Learning:** Cloudflare Workers 環境などでは CF-Connecting-IP が信頼できる IP アドレスのソースとなります。X-Forwarded-For にフォールバックすると、クライアントがヘッダーを偽装（スプーフィング）し、IP ベースのアクセス制御やレート制限を回避できる可能性があります。
**Prevention:** 信頼できるロードバランサーや CDN が設定するヘッダー（例：CF-Connecting-IP）のみを使用し、クライアントから送信される可能性のあるヘッダー（例：X-Forwarded-For）へのフォールバックは避ける。

## 2026-05-25 - [Error Logging Information Leakage]
**Vulnerability:** Raw Error objects were being passed directly to `console.error` in API routes (`apps/api/src/routes/papers.ts`, `apps/api/src/routes/invites.ts`).
**Learning:** Passing raw Error objects to the console can expose sensitive backend details, stack traces, and database structures in the application logs, which could be accessed by unauthorized parties or attackers if log access is compromised.
**Prevention:** Always sanitize Error objects before logging them. Use a dedicated formatting utility like `formatCaughtError` (which extracts safe properties like `error.name` and `error.message`) or manually format the error string (e.g., `error instanceof Error ? error.name + ": " + error.message : String(error)`) when logging in API routes.
