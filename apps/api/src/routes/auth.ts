import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, orgs, orgMembers, enableForeignKeys, touchUpdatedAt } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;
const OAUTH_STATE_TTL_SECONDS = OAUTH_STATE_TTL_MS / 1000;
const OAUTH_FLOW_NONCE_COOKIE = "oauth_flow_nonce";
const TEST_AUTH_SUB_MAX_LENGTH = 400;
const TEST_AUTH_GITHUB_ID_MAX_LENGTH = 255;
const TEST_AUTH_NAME_MAX_LENGTH = 255;
const TEST_AUTH_ORG_ID_MAX_LENGTH = 255;

function isProductionTestAuthEnv(env: Pick<Env, "NODE_ENV" | "DEPLOYMENT_ENV">) {
    return (
        env.NODE_ENV === "production" ||
        env.DEPLOYMENT_ENV === "production" ||
        env.DEPLOYMENT_ENV === "prod"
    );
}

function getBoundedString(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) return null;
    return trimmed;
}

// GET /api/auth/github — redirect to GitHub OAuth
auth.get("/github", async (c) => {
    const state = crypto.randomUUID();
    const flowNonce = crypto.randomUUID();

    // Opportunistically clean up expired states to prevent unbounded growth.
    await c.env.DB.prepare(
        "DELETE FROM oauth_states WHERE created_at <= datetime('now', '-5 minutes')",
    ).run();

    await c.env.DB.prepare(
        "INSERT INTO oauth_states (state, browser_nonce) VALUES (?, ?)",
    )
        .bind(state, flowNonce)
        .run();

    setCookie(c, OAUTH_FLOW_NONCE_COOKIE, flowNonce, {
        httpOnly: true,
        secure: new URL(c.req.url).protocol === "https:",
        sameSite: "Lax",
        maxAge: OAUTH_STATE_TTL_SECONDS,
        path: "/",
    });

    const params = new URLSearchParams({
        client_id: c.env.GITHUB_CLIENT_ID,
        redirect_uri: `${new URL(c.req.url).origin}/api/auth/github/callback`,
        scope: "read:user user:email",
        state,
    });
    return c.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
    );
});

// GET /api/auth/github/callback — exchange code, upsert user, issue JWT
auth.get("/github/callback", async (c) => {
    const code = c.req.query("code");
    const stateParam = c.req.query("state");
    const flowNonce = getCookie(c, OAUTH_FLOW_NONCE_COOKIE);

    deleteCookie(c, OAUTH_FLOW_NONCE_COOKIE, { path: "/" });

    if (!stateParam) {
        return c.json({ error: "Missing state parameter" }, 400);
    }

    if (!flowNonce) {
        return c.json({ error: "Missing OAuth flow cookie" }, 400);
    }

    const row = await c.env.DB.prepare(
        "DELETE FROM oauth_states WHERE state = ? AND browser_nonce = ? RETURNING created_at",
    )
        .bind(stateParam, flowNonce)
        .first<{ created_at: string }>();

    if (!row) {
        return c.json({ error: "Invalid or expired state" }, 400);
    }

    const createdAt = new Date(`${row.created_at}Z`);
    const nowDate = new Date();
    if (nowDate.getTime() - createdAt.getTime() > OAUTH_STATE_TTL_MS) {
        return c.json({ error: "State expired" }, 400);
    }

    if (!code) {
        return c.json({ error: "Missing code parameter" }, 400);
    }

    // Exchange code for access token
    const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: c.env.GITHUB_CLIENT_ID,
                client_secret: c.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        },
    );

    if (!tokenRes.ok) {
        const tokenErr = await tokenRes.text();
        return c.json(
            {
                error: "Failed to exchange OAuth code",
                details: tokenErr.slice(0, 200),
            },
            502,
        );
    }

    const rawTokenData = (await tokenRes.json()) as unknown;
    if (
        !rawTokenData ||
        typeof rawTokenData !== "object" ||
        typeof (rawTokenData as { access_token?: unknown }).access_token !==
        "string"
    ) {
        return c.json({ error: "Failed to get access token" }, 400);
    }
    const accessToken = (rawTokenData as { access_token: string }).access_token;

    // Get GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "OpenShelf",
        },
    });

    if (!userRes.ok) {
        const userErr = await userRes.text();
        return c.json(
            {
                error: "Failed to fetch GitHub user",
                details: userErr.slice(0, 200),
            },
            502,
        );
    }

    const rawGhUser = (await userRes.json()) as unknown;
    if (!rawGhUser || typeof rawGhUser !== "object") {
        return c.json({ error: "Invalid GitHub user payload" }, 502);
    }

    const ghUser = rawGhUser as {
        id?: unknown;
        login?: unknown;
        name?: unknown;
        avatar_url?: unknown;
        email?: unknown;
    };

    if (typeof ghUser.id !== "number" || typeof ghUser.login !== "string") {
        return c.json({ error: "Invalid GitHub user payload" }, 502);
    }

    const ghName =
        typeof ghUser.name === "string" && ghUser.name.length > 0
            ? ghUser.name
            : ghUser.login;
    const ghAvatar =
        typeof ghUser.avatar_url === "string" ? ghUser.avatar_url : null;
    const ghEmail = typeof ghUser.email === "string" ? ghUser.email : null;

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    // Upsert user atomically by githubId.
    const githubId = String(ghUser.id);
    const insertedUserId = crypto.randomUUID();
    await db
        .insert(users)
        .values({
            id: insertedUserId,
            githubId,
            name: ghName,
            avatarUrl: ghAvatar,
            email: ghEmail,
            ...touchUpdatedAt(),
        })
        .onConflictDoUpdate({
            target: users.githubId,
            set: {
                name: ghName,
                avatarUrl: ghAvatar,
                email: ghEmail,
                ...touchUpdatedAt(),
            },
        });

    const upsertedUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.githubId, githubId))
        .get();
    if (!upsertedUser) {
        return c.json({ error: "Failed to upsert user" }, 500);
    }
    const userId = upsertedUser.id;

    // Generate JWT (7-day expiry)
    const now = Math.floor(Date.now() / 1000);
    const jwt = await sign(
        {
            sub: userId,
            githubId,
            name: ghName,
            iat: now,
            exp: now + JWT_EXPIRY_SECONDS,
        },
        c.env.JWT_SECRET,
        "HS256",
    );

    const frontendUrl = c.env.FRONTEND_URL;
    if (!frontendUrl) {
        console.error("FATAL: FRONTEND_URL environment variable is not set.");
        return c.json({ error: "Server configuration error" }, 500);
    }

    const callbackUrl = new URL("/auth/callback", frontendUrl);
    callbackUrl.hash = new URLSearchParams({ token: jwt }).toString();
    return c.redirect(callbackUrl.toString());
});

// GET /api/auth/me — current user info
auth.get("/me", authMiddleware, async (c) => {
    const payload = c.get("user");
    const db = drizzle(c.env.DB);
    const user = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .get();
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
});

// POST /api/auth/logout
auth.post("/logout", async (c) => {
    return c.json({ ok: true });
});

// POST /api/auth/test-token — only for E2E testing
auth.post("/test-token", async (c) => {
    // Double check: flag must be true AND a secret key must match
    if (c.env.ENABLE_TEST_AUTH !== "true" || isProductionTestAuthEnv(c.env)) {
        return c.json({ error: "Not Found" }, 404);
    }

    const testSecret = c.req.header("x-test-auth-secret");
    if (!c.env.TEST_AUTH_SECRET || testSecret !== c.env.TEST_AUTH_SECRET) {
        return c.json({ error: "Unauthorized (E2E)" }, 401);
    }

    let body: { sub: string; githubId: string; name: string };
    try {
        const raw = await c.req.json();
        if (!raw || typeof raw !== "object") {
            return c.json({ error: "Invalid request body" }, 400);
        }

        const sub = getBoundedString(
            (raw as { sub?: unknown }).sub,
            TEST_AUTH_SUB_MAX_LENGTH,
        );
        const githubId = getBoundedString(
            (raw as { githubId?: unknown }).githubId,
            TEST_AUTH_GITHUB_ID_MAX_LENGTH,
        );
        const name = getBoundedString(
            (raw as { name?: unknown }).name,
            TEST_AUTH_NAME_MAX_LENGTH,
        );
        if (!sub || !githubId || !name) {
            return c.json({ error: "Invalid request body" }, 400);
        }
        body = { sub, githubId, name };
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

// POST /api/auth/test-org — only for E2E testing
auth.post("/test-org", async (c) => {
    if (c.env.ENABLE_TEST_AUTH !== "true" || isProductionTestAuthEnv(c.env)) {
        return c.json({ error: "Not Found" }, 404);
    }
    const testSecret = c.req.header("x-test-auth-secret");
    if (!c.env.TEST_AUTH_SECRET || testSecret !== c.env.TEST_AUTH_SECRET) {
        return c.json({ error: "Unauthorized (E2E)" }, 401);
    }

    let body: { userId: string; orgId: string };
    try {
        const raw = await c.req.json();
        if (!raw || typeof raw !== "object") {
            return c.json({ error: "userId and orgId are required" }, 400);
        }

        const userId = getBoundedString(
            (raw as { userId?: unknown }).userId,
            TEST_AUTH_SUB_MAX_LENGTH,
        );
        const orgId = getBoundedString(
            (raw as { orgId?: unknown }).orgId,
            TEST_AUTH_ORG_ID_MAX_LENGTH,
        );
        if (!userId || !orgId) {
            return c.json({ error: "userId and orgId are required" }, 400);
        }
        body = { userId, orgId };
    } catch {
        return c.json({ error: "Invalid JSON" }, 400);
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

export default auth;
