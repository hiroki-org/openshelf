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

const WILDCARD_SEGMENT_PATTERN = "[^/?#]+";

export function matchesOriginPattern(origin: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (!pattern.includes("*")) return origin === pattern;

    const escapedPattern = pattern
        .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
        .replace(/\*/g, WILDCARD_SEGMENT_PATTERN);
    return new RegExp(`^${escapedPattern}$`).test(origin);
}

export function isAllowedOrigin(
    origin: string | null | undefined,
    frontendOrigin: string | null,
    allowedOrigins: string[],
    options: { allowWildcard?: boolean } = {},
): boolean {
    if (!origin) return false;
    const allowWildcard = options.allowWildcard ?? true;
    const normalizedFrontendOrigin = frontendOrigin ? normalizeOrigin(frontendOrigin) : null;

    return (
        allowedOrigins.some((allowedOrigin) => {
            if (allowedOrigin.includes("*")) {
                if (!allowWildcard) {
                    return false;
                }
                return matchesOriginPattern(origin, allowedOrigin);
            }

            const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
            return normalizedAllowedOrigin ? origin === normalizedAllowedOrigin : origin === allowedOrigin;
        }) || origin === normalizedFrontendOrigin
    );
}

export function resolveAllowedOrigin(
    candidates: Array<string | undefined>,
    frontendUrl: string,
    allowedOrigins: string[],
): string {
    const frontendOrigin = normalizeOrigin(frontendUrl);
    for (const candidate of candidates) {
        const normalized = normalizeOrigin(candidate);
        if (isAllowedOrigin(normalized, frontendOrigin, allowedOrigins)) {
            return normalized as string;
        }
    }

    return frontendOrigin ?? frontendUrl;
}
