import { Hono } from "hono";
import { cors } from "hono/cors";
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
        origin: (origin, c) => c.env.FRONTEND_URL,
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
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