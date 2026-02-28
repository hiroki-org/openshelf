import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import type { Env, JwtPayload, Variables } from "../types";

export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    const token = getCookie(c, "token");
    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    try {
        const payload = (await verify(
            token,
            c.env.JWT_SECRET,
        )) as unknown as JwtPayload;
        c.set("user", payload);
        await next();
    } catch {
        return c.json({ error: "Invalid token" }, 401);
    }
});
