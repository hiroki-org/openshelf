/**
 * Validates and sanitizes a slug or ID to prevent path traversal.
 * Allowed characters: a-z, 0-9, and hyphen.
 * Does not allow starting/ending with a hyphen or consecutive hyphens.
 */
export function sanitizeId(value: string): string {
  // Regex from instruction.md: /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
  const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  if (slugRegex.test(value)) {
    return value;
  }
  // If invalid, we throw to prevent constructing a potentially dangerous URL.
  throw new Error(`Invalid identifier: ${value}`);
}

/**
 * Encodes the identifier for use in a URL path safely after sanitization.
 */
export function safePath(value: string): string {
  return encodeURIComponent(sanitizeId(value));
}
