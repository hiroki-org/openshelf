import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import auth from "./routes/auth";
import usersRoute from "./routes/users";
import papersRoute from "./routes/papers";
import invitesRoute from "./routes/invites";
import orgsRoute from "./routes/orgs";
import collectionsRoute from "./routes/collections";

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
    const testAuthHeader = c.req.header("x-test-auth-secret");
    const isProductionEnv =
        c.env.NODE_ENV === "production" ||
        c.env.DEPLOYMENT_ENV === "production" ||
        c.env.DEPLOYMENT_ENV === "prod";
    const isTestEnv =
        !isProductionEnv &&
        c.env.ENABLE_TEST_AUTH === "true" &&
        !!c.env.TEST_AUTH_SECRET &&
        testAuthHeader === c.env.TEST_AUTH_SECRET;

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
