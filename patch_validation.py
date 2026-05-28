import sys

with open('apps/api/src/routes/papers.ts', 'r') as f:
    content = f.read()

search = """    return {
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
            tags: meta.tags ? JSON.stringify(meta.tags) : null,
            orgId,
        }
    };"""

replace = """    const abstract = (meta.abstract as string) || null;
    if (abstract && abstract.length > MAX_ABSTRACT_LENGTH)
        return { errorResponse: c.json({ error: `abstract must be ${MAX_ABSTRACT_LENGTH} chars or less` }, 400) };

    const language = (meta.language as string) || null;
    if (language && language.length > MAX_LANGUAGE_LENGTH)
        return { errorResponse: c.json({ error: `language must be ${MAX_LANGUAGE_LENGTH} chars or less` }, 400) };

    const doi = (meta.doi as string) || null;
    if (doi && doi.length > MAX_DOI_LENGTH)
        return { errorResponse: c.json({ error: `doi must be ${MAX_DOI_LENGTH} chars or less` }, 400) };

    const venue = (meta.venue as string) || null;
    if (venue && venue.length > MAX_VENUE_LENGTH)
        return { errorResponse: c.json({ error: `venue must be ${MAX_VENUE_LENGTH} chars or less` }, 400) };

    const yearRaw = meta.year != null ? Number(meta.year) : null;
    if (yearRaw !== null && (!Number.isSafeInteger(yearRaw) || yearRaw < 0 || yearRaw > 9999))
        return { errorResponse: c.json({ error: "year must be a safe integer between 0 and 9999" }, 400) };

    const tagsRaw = meta.tags;
    let tagsJson: string | null = null;
    if (tagsRaw != null) {
        if (!Array.isArray(tagsRaw))
            return { errorResponse: c.json({ error: "tags must be an array" }, 400) };
        for (const tag of tagsRaw) {
            if (typeof tag !== "string" || tag.length > MAX_TAG_LENGTH)
                return { errorResponse: c.json({ error: `tags must contain strings of ${MAX_TAG_LENGTH} chars or less` }, 400) };
        }
        tagsJson = JSON.stringify(tagsRaw);
    }

    return {
        data: {
            title: title.trim(),
            abstract,
            visibility: vis as "public" | "org_only" | "private",
            showViewCount: Boolean(meta.showViewCount),
            language,
            externalUrl,
            doi,
            venue,
            venueType: venueType as VenueType | null,
            year: yearRaw,
            category: category as CategoryType | null,
            tags: tagsJson,
            orgId,
        }
    };"""

content = content.replace(search, replace)

with open('apps/api/src/routes/papers.ts', 'w') as f:
    f.write(content)
