import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, like, or, and, ne } from "drizzle-orm";
import { users, enableForeignKeys } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const usersRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// PATCH /api/users/me — update display_name
usersRoute.patch("/me", authMiddleware, async (c) => {
    const body = await c.req.json<{ displayName?: string | null }>();
    let trimmed = body.displayName?.trim() ?? null;
    if (trimmed !== null) {
        if (trimmed.length === 0) trimmed = null;
        else if (trimmed.length > 50)
            return c.json(
                { error: "display_name must be 50 chars or less" },
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
});

// GET /api/users/search?q=xxx — search users for coauthor invite
usersRoute.get("/search", authMiddleware, async (c) => {
    const q = c.req.query("q");
    if (!q || q.length < 2) return c.json({ users: [] });

    const db = drizzle(c.env.DB);
    const currentUserId = c.get("user").sub;

    const results = await db
        .select()
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

    return c.json({ users: results });
});

export default usersRoute;
