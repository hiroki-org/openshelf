## 2025-05-07 - [Drizzle ORM Wildcard Injection in Search]
**Vulnerability:** The Drizzle `like()` helper does not automatically escape literal wildcard characters (`%`, `_`). User input containing these characters used directly in a `like()` query can cause unexpected matches or lead to an algorithmic complexity DoS (Wildcard Injection).
**Learning:** Found in `apps/api/src/routes/users.ts` user search where `like(users.name, \`%\${q}%\`)` was used without escaping `q`.
**Prevention:** Construct the condition using the `sql` template literal with manual escaping, e.g., `sql\`\${column} LIKE \${\`%\${escapeLikeLiteral(input)}%\`} ESCAPE '\\\\'\``.
