export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const ERROR_SLUG_REQUIRED = "slug is required";
export const ERROR_SLUG_LENGTH = "slug must be 3-40 characters";
export const ERROR_SLUG_CHARACTERS =
  "slug must contain only lowercase letters, numbers, and hyphens";
export const ERROR_SLUG_HYPHENS = "slug must not contain consecutive hyphens";

export const ERROR_NAME_REQUIRED = "name is required";
export const ERROR_NAME_LENGTH = "name must be 100 characters or less";

export function validateSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return ERROR_SLUG_REQUIRED;
  const s = slug.trim().toLowerCase();
  if (s.length < 3 || s.length > 40) return ERROR_SLUG_LENGTH;
  if (!SLUG_RE.test(s)) return ERROR_SLUG_CHARACTERS;
  if (s.includes("--")) return ERROR_SLUG_HYPHENS;
  return null;
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length === 0)
    return ERROR_NAME_REQUIRED;
  if (name.trim().length > 100) return ERROR_NAME_LENGTH;
  return null;
}
