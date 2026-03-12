import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, orgs, orgMembers, enableForeignKeys } from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { persistGitHubUser } from "../utils/user-persistence";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const USER_ID_MAX_LENGTH = 128;
const GITHUB_ID_MAX_LENGTH = 64;
const USER_NAME_MAX_LENGTH = 100;
const AVATAR_URL_MAX_LENGTH = 2048;
const EMAIL_MAX_LENGTH = 320;
const authUserSelection = {
    id: users.id,
    githubId: users.githubId,
    name: users.name,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    email: users.email,
};

const hasPersistableUserLengths = ({
    candidateUserId,
    githubId,
    name,
    avatarUrl,
    email,
}: {
    candidateUserId: string;
    githubId: string;
    name: string;
    avatarUrl: string | null;
    email: string | null;
}) =>
    candidateUserId.length <= USER_ID_MAX_LENGTH &&
    githubId.length <= GITHUB_ID_MAX_LENGTH &&
    name.length <= USER_NAME_MAX_LENGTH &&
    (avatarUrl === null || avatarUrl.length <= AVATAR_URL_MAX_LENGTH) &&
    (email === null || email.length <= EMAIL_MAX_LENGTH);

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

    // Exchange code for access token
    let tokenRes: Response;
    try {
        tokenRes = await fetch(
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
    } catch (error) {
        console.error("GitHub OAuth token exchange request failed:", error);
        return c.json({ error: "Failed to exchange OAuth code" }, 502);
    }

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

    let rawTokenData: unknown;
    try {
        rawTokenData = (await tokenRes.json()) as unknown;
    } catch (error) {
        console.error("GitHub OAuth token exchange response was not valid JSON:", error);
        return c.json({ error: "Failed to exchange OAuth code" }, 502);
    }
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
    let userRes: Response;
    try {
        userRes = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "OpenShelf",
            },
        });
    } catch (error) {
        console.error("GitHub user lookup request failed:", error);
        return c.json({ error: "Failed to fetch GitHub user" }, 502);
    }

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

    let rawGhUser: unknown;
    try {
        rawGhUser = (await userRes.json()) as unknown;
    } catch (error) {
        console.error("GitHub user response was not valid JSON:", error);
        return c.json({ error: "Failed to fetch GitHub user" }, 502);
    }
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

    // Persist user and re-read it through a primary-anchored D1 session.
    const githubId = String(ghUser.id);
    const candidateUserId = crypto.randomUUID();
    if (
        !hasPersistableUserLengths({
            candidateUserId,
            githubId,
            name: ghName,
            avatarUrl: ghAvatar,
            email: ghEmail,
        })
    ) {
        return c.json({ error: "Invalid GitHub user payload" }, 502);
    }
    let userId: string;
    try {
        userId = (
            await persistGitHubUser(c.env.DB, {
                candidateUserId,
                githubId,
                name: ghName,
                avatarUrl: ghAvatar,
                email: ghEmail,
                source: "oauth-callback",
            })
        ).userId;
    } catch {
        return c.json({ error: "Failed to persist GitHub user" }, 500);
    }

    // Generate JWT (7-day expiry)
    const now = Math.floor(Date.now() / 1000);
    let jwt: string;
    try {
        jwt = await sign(
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
    } catch (error) {
        console.error(`GitHub OAuth JWT signing failed for githubId=${githubId}:`, error);
        return c.json({ error: "Failed to create session token" }, 500);
    }

    deleteCookie(c, "oauth_state", { path: "/" });
    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback#token=${jwt}`);
});

// GET /api/auth/me — current user info
auth.get("/me", authMiddleware, async (c) => {
    const payload = c.get("user");
    const db = drizzle(c.env.DB);
    const user = await db
        .select(authUserSelection)
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
    if (c.env.ENABLE_TEST_AUTH !== "true") {
        return c.json({ error: "Not Found" }, 404);
    }

    const testSecret = c.req.header("x-test-auth-secret");
    if (!c.env.TEST_AUTH_SECRET || testSecret !== c.env.TEST_AUTH_SECRET) {
        return c.json({ error: "Unauthorized (E2E)" }, 401);
    }

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
    if (
        !hasPersistableUserLengths({
            candidateUserId: body.sub,
            githubId: body.githubId,
            name: body.name,
            avatarUrl: null,
            email: null,
        })
    ) {
        return c.json({ error: "Invalid request body" }, 400);
    }

    let persistedUserId: string;
    try {
        persistedUserId = (
            await persistGitHubUser(c.env.DB, {
                candidateUserId: body.sub,
                githubId: body.githubId,
                name: body.name,
                avatarUrl: null,
                email: null,
                source: "test-token",
            })
        ).userId;
    } catch {
        return c.json({ error: "Failed to persist user" }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const jwt = await sign(
        {
            sub: persistedUserId,
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
    if (c.env.ENABLE_TEST_AUTH !== "true") {
        return c.json({ error: "Not Found" }, 404);
    }
    const testSecret = c.req.header("x-test-auth-secret");
    if (!c.env.TEST_AUTH_SECRET || testSecret !== c.env.TEST_AUTH_SECRET) {
        return c.json({ error: "Unauthorized (E2E)" }, 401);
    }

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
        })
        .onConflictDoNothing({ target: orgs.id });

    await db
        .insert(orgMembers)
        .values({
            orgId: body.orgId,
            userId: body.userId,
            role: "member",
        })
        .onConflictDoNothing({ target: [orgMembers.orgId, orgMembers.userId] });

    return c.json({ ok: true });
});

export default auth;
