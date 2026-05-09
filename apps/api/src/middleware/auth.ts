import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import type { Env, JwtPayload, Variables } from "../types";

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    token = getCookie(c, "auth_token") ?? null;
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = (await verify(
      token,
      c.env.JWT_SECRET,
      "HS256",
    )) as JwtPayload;
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});
