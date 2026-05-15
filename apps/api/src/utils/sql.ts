/**
 * Escapes literal wildcard characters (%, _) and the escape character (\) for use in SQL LIKE clauses.
 * Prevents wildcard injection which can lead to algorithmic complexity DoS.
 * @param str The user input string to escape.
 * @returns The escaped string.
 */
export function escapeLikeLiteral(str: string): string {
  return str.replace(/[\\%_]/g, "\\$&");
}
