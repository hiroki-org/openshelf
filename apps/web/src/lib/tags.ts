export const TAG_DELIMITER_PATTERN = /[,，、]/;

export function splitTagInput(value: string): string[] {
  return value
    .split(TAG_DELIMITER_PATTERN)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
