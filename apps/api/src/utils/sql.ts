const LIKE_ESCAPE_REGEX = /[\\%_]/g;

/**
 * SQL LIKE パターン内のワイルドカード文字 (`\`, `%`, `_`) をバックスラッシュでエスケープします。
 * クエリ側で `ESCAPE '\'` 句を必ず指定してください。
 */
export function escapeLikeLiteral(str: string): string {
  return str.replace(LIKE_ESCAPE_REGEX, "\\$&");
}
