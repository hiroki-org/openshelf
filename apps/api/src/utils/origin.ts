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

    const escapedPattern = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escapedPattern}$`).test(origin);
}

export function isAllowedOrigin(
    origin: string | null | undefined,
    frontendOrigin: string | null,
    allowedOrigins: string[],
): boolean {
    if (!origin) return false;
    return allowedOrigins.some((allowedOrigin) => matchesOriginPattern(origin, allowedOrigin))
        || origin === frontendOrigin;
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
