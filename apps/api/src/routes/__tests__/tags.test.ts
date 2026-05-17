import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockDb as createSharedMockDb,
  createTestApp,
  createTestEnv,
  createTestJWT,
  makeQuery,
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
            all: vi.fn().mockResolvedValue({ results: [{ tag: "AI" }] }),
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
    env.DB = {
      prepare: vi
        .fn()
        .mockReturnValue({
          bind: vi
            .fn()
            .mockReturnValue({
              all: vi
                .fn()
                .mockResolvedValue({
                  results: [{ tag: "Search" }, { tag: "Secret Notes" }],
                }),
            }),
        }),
    };
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
});
