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

## 2024-05-17 - [SQL Injection via LIKE Operator Wildcards]
**Vulnerability:** The Drizzle ORM `like()` helper does not natively escape literal wildcard characters (`%`, `_`) or support an `ESCAPE` clause, leading to wildcard injection (algorithmic complexity DoS) when using user input in `LIKE` queries.
**Learning:** `tags.ts` has multiple occurrences of `AND ${TRIMMED_TAG_SQL} LIKE ?3 || '%' ESCAPE '\\' COLLATE NOCASE` and similar constructs without escaping wildcards in user input. `escapeLikeLiteral` is defined locally in multiple routes (`orgs.ts`, `users.ts`), but it should be a shared utility and used consistently wherever user input is matched with `LIKE`.
**Prevention:** Always use a shared `escapeLikeLiteral` utility to escape user input before using it in `LIKE` queries, whether using raw SQL statements, Drizzle's `like()` (which actually requires `sql\...\` for escape clauses), or `db.prepare`.

## 2026-05-15 - [IPスプーフィングの脆弱性]
**Vulnerability:** X-Forwarded-For ヘッダーを使用した IP アドレスのフォールバック
**Learning:** Cloudflare Workers 環境などでは CF-Connecting-IP が信頼できる IP アドレスのソースとなります。X-Forwarded-For にフォールバックすると、クライアントがヘッダーを偽装（スプーフィング）し、IP ベースのアクセス制御やレート制限を回避できる可能性があります。
**Prevention:** 信頼できるロードバランサーや CDN が設定するヘッダー（例：CF-Connecting-IP）のみを使用し、クライアントから送信される可能性のあるヘッダー（例：X-Forwarded-For）へのフォールバックは避ける。
