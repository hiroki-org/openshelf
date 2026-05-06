## 2024-05-18 - [Wildcard Injection via Drizzle like()]
**Vulnerability:** Drizzle ORM's `like()` function used in `apps/api/src/routes/users.ts` without escaping wildcards.
**Learning:** `like()` in Drizzle does not automatically escape `%` and `_` characters. User input passed directly to `like()` allows for wildcard injection, which could lead to algorithmic complexity Denial of Service (DoS) attacks.
**Prevention:** Always manually escape wildcard characters in user input before passing it to SQL queries when using Drizzle, or use `sql` templates with explicit `ESCAPE` clauses.
