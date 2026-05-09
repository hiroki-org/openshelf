import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../auth";
import type { Env, Variables } from "../../types";

// Mock the verify function to avoid the "alg" option error with hono/jwt in tests, since the
// original code uses verify<JwtPayload>(token, c.env.JWT_SECRET)
vi.mock("hono/jwt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("hono/jwt")>();
  return {
    ...mod,
    verify: vi.fn().mockImplementation(async (token, secret) => {
      if (token === "invalid-token") {
        throw new Error("Invalid token");
      }
      return {
        sub: "user-123",
        githubId: "github-123",
        name: "Test User",
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      };
    }),
  };
});

describe("authMiddleware", () => {
  const SECRET = "test-secret";

  const createApp = () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use("*", async (c, next) => {
      // Mock c.env for testing
      c.env = {
        JWT_SECRET: SECRET,
        DB: undefined as any,
        BUCKET: undefined as any,
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
        FRONTEND_URL: "",
      };
      await next();
    });
    app.get("/protected", authMiddleware, (c) =>
      c.json({ user: c.get("user") }),
    );
    return app;
  };

  it("should return 401 if Authorization header and cookie are missing", async () => {
    const app = createApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("should return 401 if Authorization header doesn't start with Bearer and cookie is missing", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: {
        Authorization: "Basic something",
      },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("should return 401 if token is invalid", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid token" });
  });

  it("should return 401 if cookie token is invalid", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: {
        Cookie: "auth_token=invalid-token",
      },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid token" });
  });

  it("should call next and set user if Bearer token is valid", async () => {
    const app = createApp();

    const res = await app.request("/protected", {
      headers: {
        Authorization: `Bearer valid-token`,
      },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      user: expect.objectContaining({ sub: "user-123", name: "Test User" }),
    });
  });

  it("should call next and set user if auth_token cookie is valid", async () => {
    const app = createApp();

    const res = await app.request("/protected", {
      headers: {
        Cookie: `auth_token=valid-token`,
      },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      user: expect.objectContaining({ sub: "user-123", name: "Test User" }),
    });
  });
});
