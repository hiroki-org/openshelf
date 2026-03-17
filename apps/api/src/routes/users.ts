import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, like, or, and, ne } from "drizzle-orm";
import { users, enableForeignKeys } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const usersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/users/me — current profile
usersRoute.get("/me", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("user").sub;
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
});

const updateMeHandler = async (c: any) => {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object") {
        return c.json({ error: "Invalid request body" }, 400);
    }

    const rawDisplayName = (body as { displayName?: unknown }).displayName;
    if (
        rawDisplayName !== undefined &&
        rawDisplayName !== null &&
        typeof rawDisplayName !== "string"
    ) {
        return c.json({ error: "displayName must be a string or null" }, 400);
    }

    let trimmed = (rawDisplayName as string | null | undefined)?.trim() ?? null;
    if (trimmed !== null) {
        if (trimmed.length === 0) trimmed = null;
        else if (trimmed.length > 50)
            return c.json(
                { error: "displayName must be 50 chars or less" },
                400,
            );
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    await db
        .update(users)
        .set({ displayName: trimmed })
        .where(eq(users.id, userId));

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    return c.json({ user });
};

// PATCH/PUT /api/users/me — update display_name
usersRoute.patch("/me", authMiddleware, updateMeHandler);
usersRoute.put("/me", authMiddleware, updateMeHandler);


// Simple in-memory cache for user search
type CachedSearchResult = {
    data: any[];
    timestamp: number;
};
const searchCache = new Map<string, CachedSearchResult>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute
const MAX_CACHE_SIZE = 1000;

function getCachedResults(key: string): any[] | null {
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        searchCache.delete(key);
        searchCache.set(key, cached);
        return cached.data;
    }
    searchCache.delete(key);
    return null;
}

function setCachedResults(key: string, data: any[], maxSize = 1000) {
    if (searchCache.has(key)) {
        searchCache.delete(key);
    } else if (searchCache.size >= maxSize) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey !== undefined) {
            searchCache.delete(oldestKey);
        }
    }
    searchCache.set(key, { data, timestamp: Date.now() });
}

// GET /api/users/search?q=xxx — search users for coauthor invite
usersRoute.get("/search", authMiddleware, async (c) => {
    const q = c.req.query("q");
    if (!q || q.length < 2) return c.json({ users: [] });

    const currentUserId = c.get("user").sub;
    const cacheKey = `${q}-${currentUserId}`;

    const cachedUsers = getCachedResults(cacheKey);
    if (cachedUsers) {
        return c.json({ users: cachedUsers });
    }

    const db = drizzle(c.env.DB);

    const results = await db
        .select({
            id: users.id,
            name: users.name,
            displayName: users.displayName,
            githubId: users.githubId,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
            and(
                or(
                    like(users.name, `%${q}%`),
                    like(users.githubId, `%${q}%`),
                ),
                ne(users.id, currentUserId),
            ),
        )
        .limit(10)
        .all();

    setCachedResults(cacheKey, results, ((c.env as any).MAX_CACHE_SIZE as number) ?? 1000);

    return c.json({ users: results });
});

// GET /api/users/:id — public profile
usersRoute.get("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const user = await db
        .select({
            id: users.id,
            name: users.name,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            githubId: users.githubId,
        })
        .from(users)
        .where(eq(users.id, c.req.param("id")))
        .get();

    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
});

export default usersRoute;
