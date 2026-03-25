import { Hono } from "hono";
import { sign } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "hono/utils/buffer";
import { users, orgs, orgMembers, enableForeignKeys, touchUpdatedAt } from "../db/schema";
import type { Env, Variables } from "../types";

const testAuth = new Hono<{ Bindings: Env; Variables: Variables }>();
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

testAuth.use("*", async (c, next) => {
    if (c.env.ENABLE_TEST_AUTH !== "true" || !c.env.TEST_AUTH_SECRET) {
        return c.json({ error: "Not Found" }, 404);
    }


    const testSecret = c.req.header("x-test-auth-secret");
    const providedTestSecret = typeof testSecret === "string" ? testSecret : "";
    const expectedTestSecret = c.env.TEST_AUTH_SECRET || "DUMMY_SECRET_FOR_TIMING_EQUAL";

    if (!(await timingSafeEqual(providedTestSecret, expectedTestSecret))) {
        return c.json({ error: "Unauthorized (E2E)" }, 401);
    }

    await next();
});

// POST /api/test-auth/test-token — only for E2E testing
testAuth.post("/test-token", async (c) => {


    let body: { sub: string; githubId: string; name: string };
    try {
        const raw = await c.req.json();
        if (
            !raw ||
            typeof raw.sub !== "string" ||
            typeof raw.githubId !== "string" ||
            typeof raw.name !== "string"
        ) {
            return c.json({ error: "Invalid request body" }, 400);
        }
        body = raw;
    } catch {
        return c.json({ error: "Invalid JSON" }, 400);
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    // Upsert user
    await db
        .insert(users)
        .values({
            id: body.sub,
            githubId: body.githubId,
            name: body.name,
            avatarUrl: null,
            email: null,
            ...touchUpdatedAt(),
        })
        .onConflictDoUpdate({
            target: users.githubId,
            set: {
                name: body.name,
                ...touchUpdatedAt(),
            },
        });

    // Fetch the actual persisted user ID (in case of conflict on githubId)
    const persistedUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.githubId, body.githubId))
        .get();

    if (!persistedUser) {
        return c.json({ error: "Failed to persist user" }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const jwt = await sign(
        {
            sub: persistedUser.id,
            githubId: body.githubId,
            name: body.name,
            iat: now,
            exp: now + JWT_EXPIRY_SECONDS,
        },
        c.env.JWT_SECRET,
        "HS256",
    );

    return c.json({ token: jwt });
});

// POST /api/test-auth/test-org — only for E2E testing
testAuth.post("/test-org", async (c) => {


    let body: { userId?: string; orgId?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON" }, 400);
    }
    if (!body.userId || !body.orgId) {
        return c.json({ error: "userId and orgId are required" }, 400);
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    await db
        .insert(orgs)
        .values({
            id: body.orgId,
            slug: `test-org-${crypto.randomUUID().slice(0, 8)}`,
            name: "Test Org",
            ...touchUpdatedAt(),
        })
        .onConflictDoNothing({ target: orgs.id });

    await db
        .insert(orgMembers)
        .values({
            orgId: body.orgId,
            userId: body.userId,
            role: "member",
        })
        .onConflictDoNothing();

    return c.json({ ok: true });
});


export default testAuth;
