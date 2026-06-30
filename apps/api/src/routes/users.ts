import { Hono, Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, or, and, ne, sql, type InferSelectModel } from "drizzle-orm";
import { users, enableForeignKeys, touchUpdatedAt } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { escapeLikeLiteral } from "../utils/sql";

const usersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/users/me — current profile
usersRoute.get("/me", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("user").sub;
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
  } catch {
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

const updateMeHandler = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
) => {
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
      return c.json({ error: "displayName must be 50 chars or less" }, 400);
  }

  const db = drizzle(c.env.DB);
  await enableForeignKeys(db);
  const userId = c.get("user").sub;

  await db
    .update(users)
    .set({ displayName: trimmed, ...touchUpdatedAt() })
    .where(eq(users.id, userId));

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  return c.json({ user });
};

// PATCH/PUT /api/users/me — update display_name
usersRoute.patch("/me", authMiddleware, updateMeHandler);
usersRoute.put("/me", authMiddleware, updateMeHandler);

// Simple in-memory cache for user search
type UserSearchResult = Pick<
  InferSelectModel<typeof users>,
  "id" | "name" | "displayName" | "githubId" | "avatarUrl"
>;

type CachedSearchResult = {
  data: UserSearchResult[];
  timestamp: number;
};
const searchCache = new Map<string, CachedSearchResult>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute
const MAX_CACHE_SIZE = 1000;

function getCachedResults(key: string): UserSearchResult[] | null {
  const cached = searchCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp >= CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedResults(key: string, data: UserSearchResult[]) {
  searchCache.delete(key);

  // Evict the oldest entry if the cache has reached its maximum size (FIFO)
  if (searchCache.size >= MAX_CACHE_SIZE) {
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
  if (q.length > 100) return c.json({ error: "query too long" }, 400);

  const currentUserId = c.get("user").sub;
  const cacheKey = `${q}-${currentUserId}`;

  const cachedUsers = getCachedResults(cacheKey);
  if (cachedUsers) {
    return c.json({ users: cachedUsers });
  }

  const db = drizzle(c.env.DB);
  const escapedQuery = escapeLikeLiteral(q);

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
          sql`${users.name} LIKE '%' || ${escapedQuery} || '%' ESCAPE '\\' COLLATE NOCASE`,
          sql`${users.githubId} LIKE '%' || ${escapedQuery} || '%' ESCAPE '\\' COLLATE NOCASE`,
        ),
        ne(users.id, currentUserId),
      ),
    )
    .limit(10)
    .all();

  setCachedResults(cacheKey, results);

  return c.json({ users: results });
});

// GET /api/users/:id — public profile
usersRoute.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  try {
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
  } catch {
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

export default usersRoute;
