export function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    try {
      return new URL(decodeURIComponent(value)).origin;
    } catch {
      return null;
    }
  }
}

export function parseOriginList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
}

export function matchesOriginPattern(origin: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return origin === pattern;

  const parts = pattern.split("*");
  const escapedParts = parts.map((part) =>
    part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"),
  );
  const regexSource = `^${escapedParts.join("[a-zA-Z0-9-]+")}$`;

  return new RegExp(regexSource).test(origin);
}

export function isAllowedOrigin(
  origin: string | null | undefined,
  frontendOrigin: string | null,
  allowedOrigins: string[],
  options: { allowWildcard?: boolean } = {},
): boolean {
  if (!origin) return false;
  if (frontendOrigin && origin === frontendOrigin) return true;
  const normalizedFrontendOrigin = frontendOrigin
    ? normalizeOrigin(frontendOrigin)
    : null;
  if (normalizedFrontendOrigin && origin === normalizedFrontendOrigin)
    return true;

  const allowWildcard = options.allowWildcard ?? true;

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes("*")) {
      return allowWildcard && matchesOriginPattern(origin, allowedOrigin);
    }

    if (origin === allowedOrigin) return true;
    const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
    return normalizedAllowedOrigin ? origin === normalizedAllowedOrigin : false;
  });
}

export function resolveAllowedOrigin(
  candidates: Array<string | undefined>,
  frontendUrl: string,
  allowedOrigins: string[],
  options: { allowWildcard?: boolean } = {},
): string {
  const frontendOrigin = normalizeOrigin(frontendUrl);
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (isAllowedOrigin(normalized, frontendOrigin, allowedOrigins, options)) {
      return normalized as string;
    }
  }

  return frontendOrigin ?? frontendUrl;
}
