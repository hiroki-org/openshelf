export const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function validateSlug(slug: unknown): string | null {
    if (typeof slug !== "string") return "slug is required";
    const s = slug.trim().toLowerCase();
    if (s.length < 3 || s.length > 40) return "slug must be 3-40 characters";
    if (!SLUG_RE.test(s)) return "slug must contain only lowercase letters, numbers, and hyphens";
    if (s.includes("--")) return "slug must not contain consecutive hyphens";
    return null;
}

export function validateName(name: unknown): string | null {
    if (typeof name !== "string" || name.trim().length === 0) return "name is required";
    if (name.trim().length > 100) return "name must be 100 characters or less";
    return null;
}

export function validateDescription(description: unknown): string | null {
    if (description === undefined || description === null || description === "") return null;
    if (typeof description !== "string") return "description must be a string";
    if (description.trim().length > 500) return "description must be 500 characters or less";
    return null;
}
