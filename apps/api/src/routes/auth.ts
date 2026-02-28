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
        sameSite: isSecure ? "None" : "Lax",
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
        })
        .onConflictDoUpdate({
            target: users.githubId,
            set: {
                name: ghName,
                avatarUrl: ghAvatar,
                email: ghEmail,
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
            exp: now + 7 * 24 * 60 * 60,
        },
        c.env.JWT_SECRET,
    );

    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback#token=${jwt}`);
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

export default auth;
