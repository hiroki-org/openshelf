import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Env, JwtPayload, Variables } from "../types";

export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    try {
        const payload = await verify<JwtPayload>(
            token,
            c.env.JWT_SECRET,
            "HS256",
        );
        c.set("user", payload);
        await next();
    } catch {
        return c.json({ error: "Invalid token" }, 401);
    }
});
