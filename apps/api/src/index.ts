import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import auth from "./routes/auth";
import usersRoute from "./routes/users";
import papersRoute from "./routes/papers";
import invitesRoute from "./routes/invites";
import orgsRoute from "./routes/orgs";
import collectionsRoute from "./routes/collections";

const encoder = new TextEncoder();

const sha256 = async (value: string): Promise<Uint8Array> => {
    const data = encoder.encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(digest);
};

const timingSafeEqualString = async (a: string, b: string): Promise<boolean> => {
    const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);

    let diff = 0;
    for (let i = 0; i < hashA.length; i++) {
        diff |= hashA[i] ^ hashB[i];
    }

    return diff === 0;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use(
    "/api/*",
    cors({
        origin: (origin, c) => {
            const allowedOrigins = c.env.ALLOWED_ORIGINS
                ? c.env.ALLOWED_ORIGINS
                    .split(",")
                    .map((value: string) => value.trim())
                    .filter(Boolean)
                : undefined;

            if (allowedOrigins && allowedOrigins.length > 0) {
                return origin && allowedOrigins.includes(origin) ? origin : "";
            }

            return c.env.FRONTEND_URL;
        },
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    }),
);

// CSRF
app.use("/api/*", async (c, next) => {
    const method = c.req.method;
    // Skip CSRF for non-mutative methods
    if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) return await next();

    const origin = c.req.header("Origin");
    const referer = c.req.header("Referer");
    const authHeader = c.req.header("Authorization");
    let isTestEnv = false;
    if (process.env.NODE_ENV !== "production") {
        const testAuthHeader = c.req.header("x-test-auth-secret") ?? "";
        const configuredTestSecret = c.env.TEST_AUTH_SECRET ?? "";
        const isSecretMatch = await timingSafeEqualString(testAuthHeader, configuredTestSecret);

        isTestEnv = c.env.ENABLE_TEST_AUTH === "true" && configuredTestSecret.length > 0 && isSecretMatch;
    }

    // Bypass CSRF for requests with Bearer tokens or valid test auth secret in test env
    if (authHeader?.startsWith("Bearer ") || isTestEnv) return await next();

    try {
        const frontendOrigin = new URL(c.env.FRONTEND_URL).origin;
        const allowedOrigins = c.env.ALLOWED_ORIGINS
            ? c.env.ALLOWED_ORIGINS.split(",").map((v: string) => v.trim()).filter(Boolean)
            : [];

        const isAllowedOrigin = origin && (origin === frontendOrigin || allowedOrigins.includes(origin));
        const isAllowedReferer = referer && (new URL(referer).origin === frontendOrigin || allowedOrigins.includes(new URL(referer).origin));

        if (isAllowedOrigin || isAllowedReferer) return await next();

        console.error(`CSRF check failed: origin=${origin}, referer=${referer}, frontendOrigin=${frontendOrigin}`);
    } catch (err) {
        console.error(`CSRF check error: ${err}`);
    }

    return c.text("Forbidden", 403);
});

// Routes
app.route("/api/auth", auth);
app.route("/api/users", usersRoute);
app.route("/api/papers", papersRoute);
app.route("/api/invites", invitesRoute);
app.route("/api/orgs", orgsRoute);
app.route("/api", collectionsRoute);

// Health
app.get("/", (c) => c.json({ status: "ok", service: "openshelf-api" }));

export default app;