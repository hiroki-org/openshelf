import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestApp,
  createMockDb as createSharedMockDb,
  createTestEnv,
  createTestJWT,
  makeQuery,
  queueSelectResponses as queueSharedSelectResponses,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

function createMockDb() {
  return createSharedMockDb();
}

function queueSelectResponses(
  responses: Array<{ getResult?: unknown; allResult?: unknown[] }>,
) {
  queueSharedSelectResponses(mockDb, responses);
}

describe("collections routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = createMockDb();
  });

  it("POST /api/collections requires auth", async () => {
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          owner_type: "user",
          name: "My Collection",
          slug: "my-collection",
        }),
      },
      env as any,
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/collections ignores general db insert errors", async () => {
    const err = new Error("General insert error");
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(err),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ name: "C1", slug: "col-1", owner_type: "user" }),
      },
      env,
    );
    expect(res.status).toBe(500);
  });

  it("POST /api/collections returns 409 if slug already in use", async () => {
    const err = new Error("UNIQUE constraint failed: collections.slug");
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(err),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ name: "C1", slug: "col-1", owner_type: "user" }),
      },
      env,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "slug already in use" });
  });

  it("GET /api/collections/:id ignores invalid authorization headers", async () => {
    queueSelectResponses([{ getResult: { id: "c1", visibility: "public" } }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "GET",
        headers: { Authorization: "Bearer INVALID_TOKEN_HERE" },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("POST /api/collections returns 400 when name is invalid", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ name: "", slug: "col-1", owner_type: "user" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("POST /api/collections returns 400 when slug is invalid", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "invalid slug!",
          owner_type: "user",
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("POST /api/collections returns 400 when description is invalid", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "col-1",
          owner_type: "user",
          description: "a".repeat(1001),
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("GET /api/collections/:id returns 404 when collection is private org collection and user is not admin", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          ownerType: "org",
          ownerId: "org1",
          visibility: "private",
        },
      },
      { getResult: { role: "member" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("GET /api/collections/:id returns collection when collection is org_only org collection and user is member", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          ownerType: "org",
          ownerId: "org1",
          visibility: "org_only",
        },
      },
      { getResult: { role: "member" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/collections/:id returns 404 when collection is org_only org collection and user is not member", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          ownerType: "org",
          ownerId: "org1",
          visibility: "org_only",
        },
      },
      { getResult: null },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("POST /api/collections returns 404 if owner org not found by slug", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "col-1",
          owner_type: "org",
          org_slug: "nonexistent",
        }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/collections handles org finding by owner_id", async () => {
    queueSelectResponses([
      { getResult: { id: "org1", slug: "org-slug" } },
      { getResult: { role: "admin" } },
      { getResult: { id: "c1" } },
    ]);
    mockDb.insert = vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "org-col-1",
          owner_type: "org",
          owner_id: "org1",
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  it("POST /api/collections returns 400 for invalid visibility (string not in VALID_VISIBILITY)", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}` },
        body: JSON.stringify({ name: "C1", slug: "col-1", owner_type: "user", visibility: "invalid_string" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

  it("POST /api/collections returns 400 for invalid visibility", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "col-1",
          owner_type: "user",
          visibility: 123,
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

  it("POST /api/collections returns 400 for invalid owner_type", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C1",
          slug: "col-1",
          owner_type: "invalid-type",
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "owner_type must be 'user' or 'org'",
    });
  });
  it("POST /api/collections returns 400 for invalid JSON body", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      },
      env as any,
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("Invalid JSON body");
  });
  it("GET /api/collections/:id returns 404 when not found", async () => {
    mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/not-found",
      {},
      env as any,
    );

    expect(res.status).toBe(404);
  });

  it("GET /api/users/:id/collections filters out non-public collections when unauthenticated", async () => {
    queueSelectResponses([
      {
        allResult: [
          {
            id: "c1",
            visibility: "private",
            ownerType: "user",
            ownerId: "user2",
          },
          {
            id: "c2",
            visibility: "public",
            ownerType: "user",
            ownerId: "user2",
          },
        ],
      },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/users/user2/collections",
      {
        method: "GET",
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      collections: [
        { id: "c2", visibility: "public", ownerType: "user", ownerId: "user2" },
      ],
    });
  });
  it("GET /api/users/:id/collections returns list", async () => {
    mockDb.select = vi.fn(() =>
      makeQuery({
        allResult: [
          {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            slug: "favorites",
            name: "Favorites",
            description: null,
            visibility: "public",
          },
        ],
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/users/user-1/collections",
      {},
      env as any,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].slug).toBe("favorites");
  });

  it("POST /api/collections creates a user collection", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const createdCollection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      slug: "favorites",
      name: "Favorites",
      description: "Picked papers",
      visibility: "private",
    };
    queueSelectResponses([{ getResult: createdCollection }]);

    const insertValues = vi.fn(async () => undefined);
    mockDb.insert = vi.fn(() => ({ values: insertValues }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner_type: "user",
          name: "Favorites",
          slug: "favorites",
          description: " Picked papers ",
        }),
      },
      env as any,
    );

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: "user",
        ownerId: "user-1",
        slug: "favorites",
        name: "Favorites",
        description: "Picked papers",
        visibility: "private",
      }),
    );
  });

  it("POST /api/collections returns 403 when requester cannot manage org collections", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      { getResult: { id: "org-1", slug: "lab" } },
      { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner_type: "org",
          org_slug: "lab",
          name: "Lab picks",
          slug: "lab-picks",
          visibility: "org_only",
        }),
      },
      env as any,
    );

    expect(res.status).toBe(403);
    expect((await res.json()) as any).toEqual({
      error: "Forbidden: admin access required",
    });
  });

  it("GET /api/collections/:id hides private collections from anonymous users", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1",
      {},
      env as any,
    );

    expect(res.status).toBe(404);
  });

  it("GET /api/collections/:id returns a private collection to its owner", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as any).collection.id).toBe("col-1");
  });

  it("PATCH /api/collections/:id returns 404 when collection not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C2",
          slug: "col-2",
          description: "desc",
          visibility: "public",
        }),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("PATCH /api/collections/:id returns 403 when forbidden", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C2",
          slug: "col-2",
          description: "desc",
          visibility: "public",
        }),
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("PATCH /api/collections/:id handles invalid JSON body", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: "{invalid-json}",
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("PATCH /api/collections/:id returns 400 for invalid visibility", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ visibility: 123 }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

  it("PATCH /api/collections/:id returns 400 when visibility is an invalid string", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ visibility: "invalid_string_vis" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });
  it("PATCH /api/collections/:id ignores general db update errors", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const err = new Error("General update error");
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(err),
      }),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C2",
          slug: "col-2",
          description: "desc",
          visibility: "public",
        }),
      },
      env,
    );
    expect(res.status).toBe(500);
  });

  it("PATCH /api/collections/:id returns 409 if slug already in use", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const err = new Error("UNIQUE constraint failed: collections.slug");
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(err),
      }),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C2",
          slug: "col-2",
          description: "desc",
          visibility: "public",
        }),
      },
      env,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "slug already in use" });
  });

  it("PATCH /api/collections/:id returns 400 when name is invalid", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } }, // get collection
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ name: "" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("PATCH /api/collections/:id returns 400 when slug is invalid", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } }, // get collection
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ slug: "invalid slug!" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("PATCH /api/collections/:id returns 400 when description is invalid", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } }, // get collection
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ description: "a".repeat(1001) }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("DELETE /api/collections/:id returns 404 when collection not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("DELETE /api/collections/:id returns 403 when forbidden", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("PATCH /api/collections/:id returns 403 when user cannot manage org collection", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "org", ownerId: "org1" } },
      { getResult: null },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ name: "C2" }),
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("PATCH /api/collections/:id allows org admin to update collection", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "org", ownerId: "org1" } },
      { getResult: { role: "admin" } },
      { getResult: { id: "c1", name: "C2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({
          name: "C2",
          slug: "col-2",
          description: "desc2",
          visibility: "public",
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
  });
  it("PATCH /api/collections/:id updates collection details for the owner", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const existingCollection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      name: "Old",
      slug: "old",
      description: null,
      visibility: "private",
    };
    const updatedCollection = {
      ...existingCollection,
      name: "Renamed",
      slug: "renamed",
      visibility: "public",
    };
    queueSelectResponses([
      { getResult: existingCollection },
      { getResult: updatedCollection },
    ]);

    const setValues = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    mockDb.update = vi.fn(() => ({ set: setValues }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: " Renamed ",
          slug: "RENAMED",
          visibility: "public",
        }),
      },
      env as any,
    );

    expect(res.status).toBe(200);
    expect(setValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Renamed",
        slug: "renamed",
        visibility: "public",
      }),
    );
    expect(((await res.json()) as any).collection.slug).toBe("renamed");
  });

  it("PATCH /api/collections/:id rejects requests without updatable fields", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe("No fields to update");
  });

  it("DELETE /api/collections/:id deletes a collection for the owner", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const deleteWhere = vi.fn(async () => ({ meta: { changes: 1 } }));
    mockDb.delete = vi.fn(() => ({ where: deleteWhere }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalled();
  });

  it("GET /api/orgs/:slug/collections returns empty array when org not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/orgs/nonexistent/collections",
      {
        method: "GET",
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: [] });
  });
  it("GET /api/orgs/:slug/collections returns admin-visible collections", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      { getResult: { id: "org-1", slug: "lab" } },
      {
        allResult: [
          {
            id: "c1",
            visibility: "public",
            ownerType: "org",
            ownerId: "org-1",
          },
          {
            id: "c2",
            visibility: "org_only",
            ownerType: "org",
            ownerId: "org-1",
          },
          {
            id: "c3",
            visibility: "private",
            ownerType: "org",
            ownerId: "org-1",
          },
        ],
      },
      { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/orgs/lab/collections",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as any).collections).toHaveLength(3);
  });

  it("GET /api/orgs/:slug/collections hides private org collections from non-admin members", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      { getResult: { id: "org-1", slug: "lab" } },
      {
        allResult: [
          {
            id: "c1",
            visibility: "public",
            ownerType: "org",
            ownerId: "org-1",
          },
          {
            id: "c2",
            visibility: "org_only",
            ownerType: "org",
            ownerId: "org-1",
          },
          {
            id: "c3",
            visibility: "private",
            ownerType: "org",
            ownerId: "org-1",
          },
        ],
      },
      { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/orgs/lab/collections",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as any).collections.map((row: any) => row.id),
    ).toEqual(["c1", "c2"]);
  });

  it("POST /api/collections/:id/papers rejects invalid JSON", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "invalid-json",
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/collections/:id/papers returns 404 when collection not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_id: "p1" }),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("POST /api/collections/:id/papers returns 403 when forbidden", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_id: "p1" }),
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("POST /api/collections/:id/papers returns 404 when paper not found", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
      { getResult: null },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_id: "p1" }),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Paper not found" });
  });

  it("POST /api/collections/:id/papers ignores general db insert errors", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
      { getResult: { id: "p1" } },
      { getResult: null },
      { getResult: { c: 0 } },
      { getResult: null },
    ]);
    const err = new Error("General insert paper error");
    mockDb.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(err),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_id: "p1" }),
      },
      env,
    );
    expect(res.status).toBe(500);
  });

  it("DELETE /api/collections/:id/papers/:paperId returns 404 when collection not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers/p1",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("DELETE /api/collections/:id/papers/:paperId returns 403 when forbidden", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers/p1",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("DELETE /api/collections/:id/papers/:paperId returns 404 when paper is not in collection", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    mockDb.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    });
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers/p1",
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Paper not in collection" });
  });

  it("PATCH /api/collections/:id/papers returns 404 when collection not found", async () => {
    queueSelectResponses([{ getResult: null }]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_ids: ["p1"] }),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Collection not found" });
  });

  it("PATCH /api/collections/:id/papers returns 403 when forbidden", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user2" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_ids: ["p1"] }),
      },
      env,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("PATCH /api/collections/:id/papers returns 400 when paper not in collection", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
      { allResult: [{ paperId: "p1" }] },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_ids: ["p2"] }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "paper_ids contains paper not in collection",
    });
  });

  it("PATCH /api/collections/:id/papers updates sort order successfully via batch", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
      { allResult: [{ paperId: "p1" }, { paperId: "p2" }] },
    ]);
    mockDb.batch = vi.fn().mockResolvedValue([]);
    mockDb.update = vi
      .fn()
      .mockImplementation(() => ({
        set: vi
          .fn()
          .mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => "UPDATE_STATEMENT"),
          })),
      }));
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_ids: ["p2", "p1"] }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDb.batch).toHaveBeenCalled();
  });

  it("GET /api/collections/:id/papers returns only user authored papers when some are restricted", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          visibility: "public",
          ownerType: "user",
          ownerId: "u1",
        },
      },
      {
        allResult: [
          { id: "p1", visibility: "private" },
          { id: "p2", visibility: "public" },
        ],
      },
      { allResult: [{ paperId: "p1" }] },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { papers: Array<{ id: string }> };
    expect(data.papers.length).toBe(2);
    const ids = data.papers.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
  });

  it("GET /api/collections/:id/papers handles org_only visibility papers via membership", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          visibility: "public",
          ownerType: "user",
          ownerId: "u1",
        },
      },
      { allResult: [{ id: "p1", visibility: "org_only" }] },
      { allResult: [] },
      { allResult: [{ paperId: "p1" }] },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { papers: Array<{ id: string }> };
    expect(data.papers.length).toBe(1);
    expect(data.papers[0].id).toBe("p1");
  });

  it("GET /api/collections/:id/papers filters out private papers for authenticated users who don't have access", async () => {
    queueSelectResponses([
      {
        getResult: {
          id: "c1",
          visibility: "public",
          ownerType: "user",
          ownerId: "u1",
        },
      },
      {
        allResult: [
          { id: "p1", visibility: "private" },
          { id: "p2", visibility: "public" },
        ],
      },
      { allResult: [] },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { papers: Array<{ id: string }> };
    expect(data.papers.length).toBe(1);
    expect(data.papers[0].id).toBe("p2");
  });

  it("PATCH /api/collections/:id/papers rejects paper_ids with empty strings or non-strings", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ paper_ids: ["p1", "  ", 123] }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "paper_ids must be an array of valid strings",
    });
  });
  it("POST /api/collections/:id/papers adds a visible paper with the next sort order", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const collection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      visibility: "private",
    };
    queueSelectResponses([
      { getResult: collection },
      { getResult: { id: "paper-1", visibility: "private" } },
      { getResult: { paperId: "paper-1" } },
      { getResult: { maxOrder: 2 } },
    ]);

    const insertValues = vi.fn(async () => undefined);
    mockDb.insert = vi.fn(() => ({ values: insertValues }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith({
      collectionId: "col-1",
      paperId: "paper-1",
      sortOrder: 3,
    });
  });

  it("POST /api/collections/:id/papers adds a paper the manager can view via org membership", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const collection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      visibility: "private",
    };
    queueSelectResponses([
      { getResult: collection }, // Collection query
      { getResult: { id: "paper-1", visibility: "org_only" } }, // Paper query
      { getResult: null }, // isPaperAuthor returns false
      { getResult: { id: "user-1" } }, // isMemberOfPaperOrg returns true
      { getResult: { maxOrder: 2 } }, // maxOrder query
    ]);

    const insertValues = vi.fn(async () => undefined);
    mockDb.insert = vi.fn(() => ({ values: insertValues }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith({
      collectionId: "col-1",
      paperId: "paper-1",
      sortOrder: 3,
    });
  });

  it("POST /api/collections/:id/papers adds a public paper without specific membership", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const collection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      visibility: "private",
    };
    queueSelectResponses([
      { getResult: collection }, // Collection query
      { getResult: { id: "paper-1", visibility: "public" } }, // Paper query
      { getResult: { maxOrder: 2 } }, // maxOrder query
    ]);

    const insertValues = vi.fn(async () => undefined);
    mockDb.insert = vi.fn(() => ({ values: insertValues }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith({
      collectionId: "col-1",
      paperId: "paper-1",
      sortOrder: 3,
    });
  });

  it("POST /api/collections/:id/papers rejects papers the manager cannot view", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
      { getResult: { id: "paper-1", visibility: "private" } },
      { getResult: null },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe("Paper not found");
  });

  it("PATCH /api/collections/:id/papers rejects invalid JSON body", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "invalid-json",
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PATCH /api/collections/:id/papers rejects duplicate paper IDs", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
      {
        allResult: [{ paperId: "paper-1" }, { paperId: "paper-2" }],
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_ids: ["paper-1", "paper-1"] }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe(
      "paper_ids must not contain duplicates",
    );
  });

  it("PATCH /api/collections/:id/papers requires every existing paper to be included", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
      {
        allResult: [{ paperId: "paper-1" }, { paperId: "paper-2" }],
      },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_ids: ["paper-1"] }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe(
      "paper_ids must include all papers in collection",
    );
  });

  it("DELETE /api/collections/:id/papers/:paperId returns 404 when the paper is not in the collection", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "user",
          ownerId: "user-1",
          visibility: "private",
        },
      },
    ]);

    mockDb.delete = vi.fn(() => ({
      where: vi.fn(async () => ({ meta: { changes: 0 } })),
    }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers/paper-1",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe("Paper not in collection");
  });

  it("GET /api/collections/:id/papers filters restricted papers by authorship and org access", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    queueSelectResponses([
      {
        getResult: {
          id: "col-1",
          ownerType: "org",
          ownerId: "org-1",
          visibility: "public",
        },
      },
      {
        allResult: [
          {
            id: "paper-public",
            title: "Public",
            visibility: "public",
            sortOrder: 0,
          },
          {
            id: "paper-authored",
            title: "Mine",
            visibility: "private",
            sortOrder: 1,
          },
          {
            id: "paper-org",
            title: "Org only",
            visibility: "org_only",
            sortOrder: 2,
          },
          {
            id: "paper-hidden",
            title: "Hidden",
            visibility: "private",
            sortOrder: 3,
          },
        ],
      },
      { allResult: [{ paperId: "paper-authored" }] },
      { allResult: [{ paperId: "paper-org" }] },
    ]);

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as any).papers.map((paper: any) => paper.id),
    ).toEqual(["paper-public", "paper-authored", "paper-org"]);
  });

  it("POST /api/collections/:id/papers returns 409 when paper is already in collection", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const collection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      visibility: "private",
    };
    queueSelectResponses([
      { getResult: collection }, // Collection query
      { getResult: { id: "paper-1", visibility: "public" } }, // Paper query
      { getResult: { maxOrder: 2 } }, // maxOrder query
    ]);

    mockDb.insert = vi.fn(() => ({
      values: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "UNIQUE constraint failed: collection_papers.collection_id, collection_papers.paper_id",
          ),
        ),
    }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toBe("Paper already added");
  });
  it("POST /api/collections/:id/papers propagates unexpected db errors", async () => {
    const token = await createTestJWT({ sub: "user-1" });
    const collection = {
      id: "col-1",
      ownerType: "user",
      ownerId: "user-1",
      visibility: "private",
    };
    queueSelectResponses([
      { getResult: collection }, // Collection query
      { getResult: { id: "paper-1", visibility: "public" } }, // Paper query
      { getResult: { maxOrder: 2 } }, // maxOrder query
    ]);

    mockDb.insert = vi.fn(() => ({
      values: vi.fn().mockRejectedValue(new Error("Unexpected database error")),
    }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/collections/col-1/papers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paper_id: "paper-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(500);
  });
});
