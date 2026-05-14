export function escapeLikeLiteral(str: string): string {
  return str.replace(/[\\%_]/g, "\\$&");
}
