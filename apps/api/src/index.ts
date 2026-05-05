import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { timingSafeEqual } from "hono/utils/buffer";
import type { Env, Variables } from "./types";
import auth from "./routes/auth";
import usersRoute from "./routes/users";
import papersRoute from "./routes/papers";
import invitesRoute from "./routes/invites";
import orgsRoute from "./routes/orgs";
import tagsRoute from "./routes/tags";
import collectionsRoute from "./routes/collections";
import badgeRoute from "./routes/badge";
import feedRoute from "./routes/feed";
import {
  isAllowedOrigin,
  normalizeOrigin,
  parseOriginList,
} from "./utils/origin";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Security headers
app.use("*", secureHeaders({
  referrerPolicy: "strict-origin-when-cross-origin"
}));

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      try {
        const allowedOrigins = parseOriginList(c.env.ALLOWED_ORIGINS);
        const requestOrigin = normalizeOrigin(origin ?? undefined);
        const frontendOrigin = normalizeOrigin(c.env.FRONTEND_URL);

        if (isAllowedOrigin(requestOrigin, frontendOrigin, allowedOrigins)) {
          return origin;
        }
      } catch (err) {
        console.error(
          "CORS origin check error:",
          err instanceof Error ? err.message : String(err),
        );
      }

      return undefined;
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
  const testAuthEnabled =
    c.env.ENABLE_TEST_AUTH === "true" && !!c.env.TEST_AUTH_SECRET;
  const expectedSecret = c.env.TEST_AUTH_SECRET as string;
  const providedSecret =
    typeof testAuthHeader === "string" ? testAuthHeader : "";
  const isSecretValid = testAuthEnabled
    ? await timingSafeEqual(providedSecret, expectedSecret)
    : false;
  const isTestEnv = testAuthEnabled && isSecretValid;

  // Bypass CSRF for requests with Bearer tokens or valid test auth secret in test env
  if (authHeader?.startsWith("Bearer ") || isTestEnv) return await next();

  try {
    const frontendOrigin = normalizeOrigin(c.env.FRONTEND_URL);
    const allowedOrigins = parseOriginList(c.env.ALLOWED_ORIGINS);
    const requestOrigin = normalizeOrigin(origin ?? undefined);
    const refererOrigin = normalizeOrigin(referer ?? undefined);
    const isAllowedOriginValue = isAllowedOrigin(
      requestOrigin,
      frontendOrigin,
      allowedOrigins,
      { allowWildcard: false },
    );
    const isAllowedReferer = isAllowedOrigin(
      refererOrigin,
      frontendOrigin,
      allowedOrigins,
      { allowWildcard: false },
    );

    if (isAllowedOriginValue || isAllowedReferer) return await next();

    console.error(
      `CSRF check failed: origin=${origin}, referer=${referer}, frontendOrigin=${frontendOrigin}`,
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : "non-Error exception during CSRF check";
    console.error(`CSRF check error: ${errorMessage}`);
  }

  return c.text("Forbidden", 403);
});

// Routes
app.route("/api/auth", auth);

if (process.env.NODE_ENV !== "production") {
  const { default: testAuth } = await import("./routes/test-auth");
  app.route("/api/test-auth", testAuth);
}
app.route("/api/users", usersRoute);
app.route("/api/papers", papersRoute);
app.route("/api/invites", invitesRoute);
app.route("/api/orgs", orgsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api", collectionsRoute);
app.route("/badge", badgeRoute);
app.route("/feed", feedRoute);

// Health
app.get("/", (c) => c.json({ status: "ok", service: "openshelf-api" }));

export default app;
