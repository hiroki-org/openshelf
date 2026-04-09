import re

file_path = "apps/api/src/routes/papers.ts"

with open(file_path, "r") as f:
    content = f.read()

# Let's replace the parseAndValidateMetadata function entirely to handle tags
pattern_parse = r'function parseAndValidateMetadata\(.*?\}\n\}'

new_parse = """function parseAndValidateMetadata(c: Context, metadataStr: string): { errorResponse?: Response; data?: ParsedMetadata } {
    let meta: Record<string, unknown>;
    try {
        meta = JSON.parse(metadataStr);
    } catch {
        return { errorResponse: c.json({ error: "Invalid metadata JSON" }, 400) };
    }

    const title = meta.title as string | undefined;
    if (
        !title ||
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > MAX_TITLE_LENGTH
    )
        return { errorResponse: c.json({ error: `title is required (1-${MAX_TITLE_LENGTH} chars)` }, 400) };

    const vis = (meta.visibility as string) || "private";
    if (!VALID_VISIBILITY.includes(vis))
        return { errorResponse: c.json({ error: "Invalid visibility" }, 400) };

    const venueType = (meta.venueType as string | null | undefined) ?? null;
    if (venueType !== null && !(VALID_VENUE_TYPES as readonly string[]).includes(venueType))
        return { errorResponse: c.json({ error: "Invalid venueType" }, 400) };

    const category = (meta.category as string | null | undefined) ?? null;
    if (category !== null && !(VALID_CATEGORIES as readonly string[]).includes(category))
        return { errorResponse: c.json({ error: "Invalid category" }, 400) };

    const externalUrl = (meta.externalUrl as string) || null;
    if (externalUrl && !isValidUrlScheme(externalUrl)) {
        return { errorResponse: c.json({ error: "Invalid externalUrl scheme (only http/https allowed)" }, 400) };
    }

    if (
        meta.showViewCount !== undefined
        && typeof meta.showViewCount !== "boolean"
    ) {
        return { errorResponse: c.json({ error: "showViewCount must be a boolean" }, 400) };
    }

    const orgId = meta.orgId as string | undefined;
    if (vis === "org_only" && !orgId) {
        return { errorResponse: c.json({ error: "orgId is required for org_only visibility" }, 400) };
    }

    let parsedTags: string | null = null;
    if ("tags" in meta) {
        if (Array.isArray(meta.tags)) {
            const normalizedTags: string[] = [];
            for (const tag of meta.tags) {
                if (typeof tag !== "string") {
                    return { errorResponse: c.json({ error: "each tag must be a string" }, 400) };
                }
                const normalizedTag = tag.trim();
                if (normalizedTag.length === 0) continue;
                if (normalizedTag.length > MAX_TAG_LENGTH) {
                    return { errorResponse: c.json({ error: `each tag must be ${MAX_TAG_LENGTH} chars or less` }, 400) };
                }
                normalizedTags.push(normalizedTag);
            }
            parsedTags = normalizedTags.length > 0 ? JSON.stringify(normalizedTags) : null;
        } else if (meta.tags === null) {
            parsedTags = null;
        } else {
            return { errorResponse: c.json({ error: "tags must be an array or null" }, 400) };
        }
    }

    return {
        data: {
            title: title.trim(),
            abstract: (meta.abstract as string) || null,
            visibility: vis as "public" | "org_only" | "private",
            showViewCount: Boolean(meta.showViewCount),
            language: (meta.language as string) || null,
            externalUrl,
            doi: (meta.doi as string) || null,
            venue: (meta.venue as string) || null,
            venueType: venueType as VenueType | null,
            year: meta.year ? Number(meta.year) : null,
            category: category as CategoryType | null,
            tags: parsedTags,
            orgId,
        }
    };
}"""

new_content = re.sub(pattern_parse, new_parse, content, flags=re.DOTALL)

with open(file_path, "w") as f:
    f.write(new_content)

print("Updated tags validation")
