export function parseStoredTags(rawTags: string | null): string[] {
  if (!rawTags) return [];
  try {
    const parsed = JSON.parse(rawTags);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  } catch {
    return [];
  }
}
