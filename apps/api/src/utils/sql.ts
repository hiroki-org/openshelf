/**
 * Escapes literal wildcard characters (`%`, `_`) and the backslash (`\`) itself
 * so they can be safely used as literal text inside a SQL LIKE clause without
 * risking wildcard injection (which can lead to algorithmic complexity DoS).
 *
 * It's important to use this along with an explicit `ESCAPE '\'` clause in your SQL query.
 * For example, if you want to search for "100%", you should do:
 * ```sql
 *   sql`${column} LIKE ${`%${escapeLikeLiteral(input)}%`} ESCAPE '\\'`
 * ```
 */
export function escapeLikeLiteral(str: string): string {
    return str.replace(/[\\%_]/g, "\\$&");
}
