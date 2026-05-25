import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockDb as createSharedMockDb,
  createTestApp,
  createTestEnv,
  createTestJWT,
  queueSelectResponses as queueSharedSelectResponses,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

function createMockDb(overrides: Record<string, any> = {}) {
  return createSharedMockDb(overrides);
}

function queueSelectResponses(
  responses: Array<{ getResult?: unknown; allResult?: unknown[] }>,
) {
  queueSharedSelectResponses(mockDb, responses);
}

describe("tags routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = createMockDb();
  });

  it("GET /api/tags/suggest returns empty for short queries", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/tags/suggest?q=a",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tags: [] });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("GET /api/tags/suggest rejects overly long queries", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      `http://localhost/api/tags/suggest?q=${"a".repeat(101)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "query too long" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("GET /api/tags/suggest returns prefix-matched tags for current user", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    const app = await createTestApp();
    const env = createTestEnv();
    (env.DB as any).prepare = vi
      .fn()
      .mockReturnValue({
        bind: vi
          .fn()
          .mockReturnValue({
            all: vi.fn().mockReturnValue({ results: [{ tag: "AI" }] }),
          }),
      });
    const res = await app.request(
      "http://localhost/api/tags/suggest?q=AI",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tags: ["AI"] });
  });

  it("GET /api/tags/suggest returns 403 when org slug is specified by non-member", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    queueSelectResponses([{ getResult: { id: "org-1" } }, { getResult: null }]);

    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/tags/suggest?q=AI&orgSlug=my-lab",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("GET /api/tags/suggest excludes private org paper tags for non-authors", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    queueSelectResponses([
      { getResult: { id: "org-1" } },
      { getResult: { userId: "user-1" } },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();
    (env.DB as any).prepare = vi
      .fn()
      .mockReturnValue({
        bind: vi
          .fn()
          .mockReturnValue({
            all: vi
              .fn()
              .mockReturnValue({
                results: [{ tag: "Search" }, { tag: "Secret Notes" }],
              }),
          }),
      });
    const res = await app.request(
      "http://localhost/api/tags/suggest?q=Se&orgSlug=my-lab",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      tags: ["Search", "Secret Notes"],
    });
  });

  it("GET /api/tags/suggest escapes wildcard characters to prevent algorithmic DoS", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Tester",
    });

    const app = await createTestApp();
    const env = createTestEnv();
    const bind = vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue({ results: [] }),
    });

    (env.DB as any).prepare = vi.fn().mockReturnValue({ bind });

    const res = await app.request(
      "http://localhost/api/tags/suggest?q=%25%5C_", // %\_
      { headers: { Authorization: `Bearer ${token}` } },
      env as any,
    );

    expect(res.status).toBe(200);
    const normalized = bind.mock.calls[0][1] as string;
    expect(normalized).toContain("\\%");
    expect(normalized).toContain("\\\\");
    expect(normalized).toContain("\\_");
  });

  it("GET /api/tags/suggest escapes wildcard characters with orgSlug", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Tester",
    });

    const app = await createTestApp();
    const env = createTestEnv();
    const bind = vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue({ results: [] }),
    });

    queueSelectResponses([
      { getResult: { id: "org-1" } },
      { getResult: { userId: "user-1" } },
    ]);

    (env.DB as any).prepare = vi.fn().mockReturnValue({ bind });

    const res = await app.request(
      "http://localhost/api/tags/suggest?q=%25%5C_&orgSlug=test-org", // %\_
      { headers: { Authorization: `Bearer ${token}` } },
      env as any,
    );

    expect(res.status).toBe(200);
    const normalized = bind.mock.calls[0][2] as string;
    expect(normalized).toContain("\\%");
    expect(normalized).toContain("\\\\");
    expect(normalized).toContain("\\_");
  });

  it("GET /api/tags/suggest returns 404 when orgSlug is not found", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Tester",
    });

    const app = await createTestApp();
    const env = createTestEnv();

    queueSelectResponses([{ getResult: null }]);

    const res = await app.request(
      "http://localhost/api/tags/suggest?q=org&orgSlug=test-org",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Org not found");
  });

  it("GET /api/tags/suggest returns 403 when user is not a member of the org", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Tester",
    });

    const app = await createTestApp();
    const env = createTestEnv();

    queueSelectResponses([{ getResult: { id: "org-1" } }, { getResult: null }]);

    const res = await app.request(
      "http://localhost/api/tags/suggest?q=org&orgSlug=test-org",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Forbidden");
  });
});
