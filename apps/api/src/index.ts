import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import type { Env, Variables } from "./types";
import auth from "./routes/auth";
import usersRoute from "./routes/users";
import papersRoute from "./routes/papers";
import invitesRoute from "./routes/invites";

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
app.use(
    "/api/*",
    csrf({
        origin: (origin, c) => {
            // Bypass CSRF for E2E/API clients without an Origin (since they use Bearer tokens)
            if (!origin) return true;
            try {
                const frontendOrigin = new URL(c.env.FRONTEND_URL).origin;
                if (origin === frontendOrigin) return true;

                const allowedOrigins = c.env.ALLOWED_ORIGINS
                    ? c.env.ALLOWED_ORIGINS
                        .split(",")
                        .map((v: string) => v.trim())
                        .filter(Boolean)
                    : [];
                if (allowedOrigins.includes(origin)) return true;

                return false;
            } catch {
                return false;
            }
        },
    }),
);

// Routes
app.route("/api/auth", auth);
app.route("/api/users", usersRoute);
app.route("/api/papers", papersRoute);
app.route("/api/invites", invitesRoute);

// Health
app.get("/", (c) => c.json({ status: "ok", service: "openshelf-api" }));

export default app;