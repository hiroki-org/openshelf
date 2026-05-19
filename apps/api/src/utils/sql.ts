/**
 * Escapes literal wildcard characters (% and _) and backslashes
 * to prevent algorithmic complexity DoS in LIKE queries.
 *
 * @param str The string to escape
 * @returns The escaped string, safe for use in LIKE ... ESCAPE '\'
 */
export function escapeLikeLiteral(str: string): string {
  return str.replace(/[\\%_]/g, "\\$&");
}
