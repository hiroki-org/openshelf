import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, enableForeignKeys } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/auth/github — redirect to GitHub OAuth
auth.get("/github", async (c) => {
    const state = crypto.randomUUID();
    const isSecure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "oauth_state", state, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "Lax",
        path: "/",
        maxAge: 600,
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
    const state = c.req.query("state");
    const storedState = getCookie(c, "oauth_state");

    if (!code || !state || state !== storedState) {
        return c.json({ error: "Invalid OAuth state" }, 400);
    }
    deleteCookie(c, "oauth_state", { path: "/" });

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
    const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
    };
    if (!tokenData.access_token) {
        return c.json({ error: "Failed to get access token" }, 400);
    }

    // Get GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "User-Agent": "OpenShelf",
        },
    });
    const ghUser = (await userRes.json()) as {
        id: number;
        login: string;
        name: string | null;
        avatar_url: string;
        email: string | null;
    };

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);

    // Upsert user
    const githubId = String(ghUser.id);
    const existing = await db
        .select()
        .from(users)
        .where(eq(users.githubId, githubId))
        .get();

    let userId: string;
    if (existing) {
        await db
            .update(users)
            .set({
                name: ghUser.name || ghUser.login,
                avatarUrl: ghUser.avatar_url,
                email: ghUser.email,
            })
            .where(eq(users.id, existing.id));
        userId = existing.id;
    } else {
        userId = crypto.randomUUID();
        await db.insert(users).values({
            id: userId,
            githubId,
            name: ghUser.name || ghUser.login,
            avatarUrl: ghUser.avatar_url,
            email: ghUser.email,
        });
    }

    // Generate JWT (7-day expiry)
    const now = Math.floor(Date.now() / 1000);
    const jwt = await sign(
        {
            sub: userId,
            githubId,
            name: ghUser.name || ghUser.login,
            exp: now + 7 * 24 * 60 * 60,
        },
        c.env.JWT_SECRET,
    );

    const isSecure = new URL(c.req.url).protocol === "https:";
    setCookie(c, "token", jwt, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "Lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
    });

    return c.redirect(c.env.FRONTEND_URL);
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

// POST /api/auth/logout — clear cookie
auth.post("/logout", async (c) => {
    deleteCookie(c, "token", { path: "/" });
    return c.json({ ok: true });
});

export default auth;
