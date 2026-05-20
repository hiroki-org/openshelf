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

function createMockDb(overrides: Record<string, any> = {}) {
  return createSharedMockDb(overrides);
}

function queueSelectResponses(
  responses: Array<{ getResult?: unknown; allResult?: unknown[] }>,
) {
  queueSharedSelectResponses(mockDb, responses);
}

describe("orgs routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = createMockDb();
  });

  // ─── POST /api/orgs ────────────────────────────────────────
  describe("POST /api/orgs", () => {
    it("returns 400 for invalid description", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Lab", slug: "lab", description: 123 }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "description must be a string",
      });
    });

    it("throws generic error during insert if not UNIQUE constraint", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      mockDb.insert = vi.fn().mockImplementationOnce(() => ({
        values: vi.fn(async () => {
          throw new Error("Some other DB error");
        }),
      }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Lab", slug: "lab" }),
        },
        env as any,
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain("Internal Server Error");
    });

    it("returns 409 for UNIQUE constraint violation race condition", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      mockDb.insert = vi
        .fn()
        .mockImplementationOnce(() => ({
          values: vi.fn(async () => {
            throw new Error("UNIQUE constraint failed: orgs.slug");
          }),
        }))
        .mockImplementation(() => ({
          values: vi.fn(async () => undefined),
        }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Race Condition Lab",
            slug: "race-lab",
          }),
        },
        env as any,
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBe("slug already in use");
    });

    it("creates org and returns 201", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const createdOrg = {
        id: "org-1",
        slug: "my-lab",
        name: "My Lab",
        description: null,
        createdAt: "2026-01-01",
      };
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        // First call: check slug uniqueness (not found)
        // Second call: fetch created org
        if (selectCallCount <= 1) return makeQuery({ getResult: null });
        return makeQuery({ getResult: createdOrg });
      });
      mockDb.insert = vi.fn(() => ({ values: vi.fn(async () => undefined) }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "My Lab", slug: "my-lab" }),
        },
        env as any,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.org.slug).toBe("my-lab");
    });

    it("returns 400 for invalid JSON body", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "invalid json string",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });

    it("returns 400 for invalid slug", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Test", slug: "ab" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate slug", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      mockDb.select = vi.fn(() =>
        makeQuery({ getResult: { id: "existing", slug: "taken" } }),
      );

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Test", slug: "taken" }),
        },
        env as any,
      );

      expect(res.status).toBe(409);
    });

    it("returns 400 for missing name", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: "valid-slug" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON bodies", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });
  });

  // ─── GET /api/orgs/:slug ──────────────────────────────────
  describe("GET /api/orgs/:slug", () => {
    it("returns org detail", async () => {
      const org = {
        id: "org-1",
        slug: "my-lab",
        name: "My Lab",
        description: null,
        createdAt: "2026-01-01",
      };
      queueSelectResponses([
        { getResult: org },
        { getResult: { count: 3 } },
        { getResult: { count: 7 } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {},
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.org.slug).toBe("my-lab");
      expect(body.memberCount).toBe(3);
      expect(body.paperCount).toBe(7);
    });

    it("returns 404 for non-existent org", async () => {
      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/not-found",
        {},
        env as any,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/orgs/:slug", () => {
    it("returns 400 when no fields to update", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
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
      await expect(res.json()).resolves.toEqual({
        error: "No fields to update",
      });
    });

    it("returns 400 for invalid slug", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: "ab" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "slug must be 3–40 characters",
      });
    });

    it("returns 409 if new slug already in use", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
        { getResult: { id: "org-2", slug: "taken-lab" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: "taken-lab" }),
        },
        env as any,
      );

      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toEqual({
        error: "slug already in use",
      });
    });

    it("returns 400 for invalid name update", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "name is required" });
    });

    it("returns 400 for invalid description update", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: 123 }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "description must be a string",
      });
    });

    it("updates the org for admins", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "Renamed Lab",
            description: "Updated",
          },
        },
      ]);

      const setValues = vi.fn(() => ({
        where: vi.fn(async () => ({ meta: { changes: 1 } })),
      }));
      mockDb.update = vi.fn(() => ({ set: setValues }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: " Renamed Lab ",
            description: " Updated ",
          }),
        },
        env as any,
      );

      expect(res.status).toBe(200);
      expect(setValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Renamed Lab",
          description: "Updated",
        }),
      );
    });

    it("returns 400 for invalid JSON bodies", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        {
          getResult: {
            id: "org-1",
            slug: "my-lab",
            name: "My Lab",
            description: null,
          },
        },
        { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });
  });

  // ─── DELETE /api/orgs/:slug ────────────────────────────────
  describe("DELETE /api/orgs/:slug", () => {
    it("returns 403 if not admin", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return makeQuery({ getResult: org });
        // membership check: member, not admin
        return makeQuery({
          getResult: { orgId: "org-1", userId: "user-1", role: "member" },
        });
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(403);
    });

    it("deletes the org for admins", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
      ]);

      const deleteWhere = vi.fn(async () => ({ meta: { changes: 1 } }));
      mockDb.delete = vi.fn(() => ({ where: deleteWhere }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab",
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
  });

  // ─── Member management ────────────────────────────────────
  describe("POST /api/orgs/:slug/members", () => {
    it("returns 400 for invalid JSON body", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });

    it("returns 400 for missing userId", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "userId is required",
      });
    });

    it("returns 400 for invalid role", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: "user-2", role: "superadmin" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "role must be 'admin' or 'member'",
      });
    });

    it("returns 404 when target user is not found", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: "user-2", role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "User not found" });
    });

    it("throws generic error during insert if not UNIQUE constraint", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: { id: "user-2" } },
        { getResult: null },
      ]);

      mockDb.insert = vi.fn().mockImplementationOnce(() => ({
        values: vi.fn(async () => {
          throw new Error("Some other DB error");
        }),
      }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: "user-2", role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(500);
    });

    it("returns 403 without auth (CSRF blocks before auth middleware)", async () => {
      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "user-2", role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(403);
    });

    it("returns 409 when the user is already a member", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: { id: "user-2", name: "Member" } },
        { getResult: { orgId: "org-1", userId: "user-2", role: "member" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: "user-2", role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(409);
      expect(((await res.json()) as any).error).toBe(
        "User is already a member",
      );
    });
  });

  describe("PATCH /api/orgs/:slug/members/:userId", () => {
    it("returns 400 for invalid JSON body", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };

      queueSelectResponses([
        { getResult: org },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });

    it("returns 404 when the target membership does not exist", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };

      queueSelectResponses([
        { getResult: org },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "Member not found" });
    });

    it("returns 200 when an owner modifies another owner role", async () => {
      const token = await createTestJWT({
        sub: "owner-1",
        githubId: "123",
        name: "Owner 1",
      });
      const org = { id: "org-1", slug: "my-lab" };

      queueSelectResponses([
        { getResult: org },
        { getResult: { orgId: "org-1", userId: "owner-1", role: "owner" } }, // requireOrgAdmin
        { getResult: { orgId: "org-1", userId: "owner-2", role: "owner" } }, // getOrgMembership (target)
      ]);
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            meta: { changes: 1 }, // simulate successful update
          })),
        })),
      }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/owner-2",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
    it("returns 403 when an admin tries to modify an owner's role", async () => {
      const token = await createTestJWT({
        sub: "admin-user",
        githubId: "123",
        name: "Admin Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };

      queueSelectResponses([
        { getResult: org },
        { getResult: { orgId: "org-1", userId: "admin-user", role: "admin" } }, // requireOrgAdmin
        { getResult: { orgId: "org-1", userId: "owner-user", role: "owner" } }, // getOrgMembership (target)
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/owner-user",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(403);
      expect(((await res.json()) as any).error).toBe(
        "Forbidden: admin cannot modify owner role",
      );
    });
    it("returns 400 for invalid role", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return makeQuery({ getResult: org });
        return makeQuery({
          getResult: { orgId: "org-1", userId: "user-1", role: "admin" },
        });
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "superadmin" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/orgs/:slug/members ──────────────────────────
  describe("GET /api/orgs/:slug/members", () => {
    it("returns 404 when org does not exist", async () => {
      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/nonexistent/members",
        {},
        env as any,
      );

      expect(res.status).toBe(404);
    });

    it("returns members for an existing org", async () => {
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        {
          allResult: [
            {
              userId: "user-1",
              role: "admin",
              name: "Tester",
              displayName: null,
              avatarUrl: null,
              githubId: "tester",
            },
          ],
        },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members",
        {},
        env as any,
      );

      expect(res.status).toBe(200);
      expect(((await res.json()) as any).members).toHaveLength(1);
    });
  });

  // ─── Paper association ────────────────────────────────────
  describe("POST /api/orgs/:slug/papers", () => {
    it("returns 400 for invalid JSON body", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{",
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    });

    it("returns 400 for missing paperId", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "paperId is required",
      });
    });

    it("returns 404 when paper is not found", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: null }, // paper
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paperId: "paper-1" }),
        },
        env as any,
      );

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "Paper not found" });
    });

    it("returns 403 when not org admin or paper author", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { id: "paper-1" } }, // paper
        { getResult: null }, // not org admin
        { getResult: null }, // not paper author
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paperId: "paper-1" }),
        },
        env as any,
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        error: "Forbidden: must be org admin or paper author",
      });
    });

    it("throws generic error during paper association if not UNIQUE constraint and logs error", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { id: "paper-1", title: "Paper" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null }, // author check
        { getResult: null }, // not already associated
      ]);

      mockDb.insert = vi.fn().mockReturnValueOnce({
        values: vi.fn().mockRejectedValueOnce(new Error("Some other DB error")),
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const app = await createTestApp();
      const env = createTestEnv();

      let res;
      try {
        res = await app.request(
          "http://localhost/api/orgs/my-lab/papers",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ paperId: "paper-1" }),
          },
          env as any,
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }

      expect(res.status).toBe(500);
    });

    it("returns 403 without auth (CSRF blocks before auth middleware)", async () => {
      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: "paper-1" }),
        },
        env as any,
      );

      expect(res.status).toBe(403);
    });

    it("allows paper authors to associate papers without admin membership", async () => {
      const token = await createTestJWT({
        sub: "user-2",
        githubId: "456",
        name: "Author",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { id: "paper-1", title: "Paper" } },
        { getResult: null },
        {
          getResult: { paperId: "paper-1", userId: "user-2", role: "uploader" },
        },
        { getResult: null },
      ]);

      const insertValues = vi.fn(async () => undefined);
      mockDb.insert = vi.fn(() => ({ values: insertValues }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paperId: "paper-1" }),
        },
        env as any,
      );

      expect(res.status).toBe(201);
      expect(insertValues).toHaveBeenCalledWith({
        orgId: "org-1",
        paperId: "paper-1",
      });
    });

    it("returns 409 when the paper is already associated", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Admin",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { id: "paper-1", title: "Paper" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null },
        { getResult: { paperId: "paper-1", orgId: "org-1" } },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paperId: "paper-1" }),
        },
        env as any,
      );

      expect(res.status).toBe(409);
      expect(((await res.json()) as any).error).toBe(
        "Paper is already associated with this org",
      );
    });
  });

  describe("GET /api/orgs/:slug/papers", () => {
    it("returns 404 when org does not exist", async () => {
      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/nonexistent/papers",
        {},
        env as any,
      );

      expect(res.status).toBe(404);
    });

    it("returns public and org_only papers to org members", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Member",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        {
          allResult: [],
        },
        {
          getResult: { maxYear: 2025 },
        },
        {
          getResult: { count: 2 },
        },
        {
          allResult: [
            {
              id: "paper-public",
              title: "Public",
              visibility: "public",
              year: 2025,
            },
            {
              id: "paper-org",
              title: "Org",
              visibility: "org_only",
              year: 2025,
            },
          ],
        },
        { allResult: [{ value: 2025, count: 2 }] },
        { allResult: [{ value: "ASE", count: 1 }] },
        { allResult: [{ value: "report", count: 2 }] },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?paginate=1&autoYear=1",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.papers.map((paper: any) => paper.id)).toEqual([
        "paper-public",
        "paper-org",
      ]);
      expect(body.total).toBe(2);
      expect(body.appliedFilters.year).toBe(2025);
    });

    it("returns authored private papers even when the requester is not an org member", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Author",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: null },
        {
          allResult: [{ paperId: "paper-private" }],
        },
        {
          getResult: { maxYear: 2024 },
        },
        {
          getResult: { count: 2 },
        },
        {
          allResult: [
            {
              id: "paper-public",
              title: "Public",
              visibility: "public",
              year: 2024,
            },
            {
              id: "paper-private",
              title: "Private",
              visibility: "private",
              year: 2024,
            },
          ],
        },
        { allResult: [{ value: 2024, count: 2 }] },
        { allResult: [] },
        { allResult: [] },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?paginate=1&autoYear=1",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.papers.map((paper: any) => paper.id)).toEqual([
        "paper-public",
        "paper-private",
      ]);
      expect(body.appliedFilters.year).toBe(2024);
    });

    it("returns all visible papers in non-paginated mode", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Member",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        { allResult: [] },
        {
          allResult: [
            {
              id: "paper-public",
              title: "Public",
              visibility: "public",
              year: 2025,
            },
            {
              id: "paper-org",
              title: "Org",
              visibility: "org_only",
              year: 2025,
            },
          ],
        },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        { headers: { Authorization: `Bearer ${token}` } },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.papers.map((paper: any) => paper.id)).toEqual([
        "paper-public",
        "paper-org",
      ]);
    });

    it("applies year, venue, category and page query parameters", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Member",
      });
      const offsetSpy = vi.fn(() => queryWithOffset);
      let callIndex = 0;
      let queryWithOffset: ReturnType<typeof makeQuery>;
      mockDb.select = vi.fn(() => {
        callIndex += 1;
        if (callIndex === 1)
          return makeQuery({ getResult: { id: "org-1", slug: "my-lab" } });
        if (callIndex === 2)
          return makeQuery({
            getResult: { orgId: "org-1", userId: "user-1", role: "member" },
          });
        if (callIndex === 3) return makeQuery({ allResult: [] });
        if (callIndex === 4) return makeQuery({ getResult: { count: 1 } });
        if (callIndex === 5) {
          queryWithOffset = makeQuery({
            allResult: [
              {
                id: "paper-1",
                title: "Filtered",
                visibility: "public",
                year: 2023,
                venue: "ASE",
                category: "report",
              },
            ],
          });
          queryWithOffset.offset = offsetSpy;
          return queryWithOffset;
        }
        if (callIndex === 6)
          return makeQuery({ allResult: [{ value: 2023, count: 1 }] });
        if (callIndex === 7)
          return makeQuery({ allResult: [{ value: "ASE", count: 1 }] });
        if (callIndex === 8)
          return makeQuery({ allResult: [{ value: "report", count: 1 }] });
        throw new Error(`unexpected select call #${callIndex}`);
      });

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?paginate=1&autoYear=1&year=2023&venue=ASE&category=report&page=2",
        { headers: { Authorization: `Bearer ${token}` } },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.page).toBe(2);
      expect(offsetSpy).toHaveBeenCalledWith(20);
      expect(body.appliedFilters).toEqual({
        year: 2023,
        venue: "ASE",
        category: "report",
      });
      expect(body.filterOptions.years).toEqual([{ value: 2023, count: 1 }]);
    });

    it("returns 400 for invalid venue query", async () => {
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?venue=" + "a".repeat(101),
        {},
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "venue must be 100 characters or less",
      });
    });

    it("returns 400 for invalid category query", async () => {
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?category=invalid",
        {},
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid category" });
    });

    it("returns properly filtered papers for non-members who are authors", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Author",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: null }, // not a member
        {
          allResult: [{ paperId: "paper-org" }, { paperId: "paper-private" }], // authored papers
        },
        {
          allResult: [
            { id: "paper-public", visibility: "public" },
            { id: "paper-org", visibility: "org_only" },
            { id: "paper-private", visibility: "private" },
          ],
        },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers",
        { headers: { Authorization: `Bearer ${token}` } },
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.papers).toBeDefined();
    });

    it("returns 400 for invalid page query", async () => {
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?paginate=1&page=2foo",
        {},
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid page" });
    });

    it("returns 400 for invalid year query", async () => {
      queueSelectResponses([{ getResult: { id: "org-1", slug: "my-lab" } }]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers?paginate=1&year=2025abc",
        {},
        env as any,
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "Invalid year" });
    });
  });

  describe("GET /api/orgs/:slug/tags", () => {
    it("handles invalid JWT payload in hasJwtSub", async () => {
      const app = await createTestApp();
      const env = createTestEnv();

      // Setup jwt.verify to return an invalid object instead of a valid token
      const token = await createTestJWT({ invalid: true });

      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { allResult: [] }, // org papers
      ]);

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/tags",
        { headers: { Authorization: `Bearer ${token}` } },
        env as any,
      );

      expect(res.status).toBe(200);
    });

    it("returns tags from visible org papers", async () => {
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        {
          allResult: [
            {
              id: "paper-public",
              visibility: "public",
              tags: '["AI","NLP"]',
              authorUserId: null,
            },
            {
              id: "paper-org",
              visibility: "org_only",
              tags: '["AI"]',
              authorUserId: "user-1",
            },
          ],
        },
      ]);

      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Member",
      });
      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/tags",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ tags: ["AI", "NLP"] });
    });

    it("filters tags by query and handles redundant tags with caching logic", async () => {
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        {
          allResult: [
            {
              id: "paper-1",
              visibility: "public",
              tags: '["AI","NLP"]',
              authorUserId: null,
            },
            {
              id: "paper-2",
              visibility: "public",
              tags: '["AI","NLP"]', // Triggers tagCache
              authorUserId: null,
            },
            {
              id: "paper-3",
              visibility: "public",
              tags: '["AI","Machine Learning"]', // Triggers lowerCache for "AI"
              authorUserId: null,
            },
          ],
        },
      ]);

      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Member",
      });
      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/tags?q=m",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(200);
      // Only "Machine Learning" starts with "m"
      await expect(res.json()).resolves.toEqual({ tags: ["Machine Learning"] });
    });

    it("limits public org tag responses to 100 items", async () => {
      const manyTags = Array.from(
        { length: 105 },
        (_, index) => `tag-${String(index).padStart(3, "0")}`,
      );
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        {
          allResult: manyTags.map((tag, index) => ({
            id: `paper-${index}`,
            visibility: "public",
            tags: JSON.stringify([tag]),
            authorUserId: null,
          })),
        },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();
      const res = await app.request(
        "http://localhost/api/orgs/my-lab/tags",
        {},
        env as any,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { tags: string[] };
      expect(body.tags).toHaveLength(100);
      expect(body.tags).toEqual(manyTags.slice(0, 100));
    });

    it("returns 404 when org does not exist", async () => {
      mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

      const app = await createTestApp();
      const env = createTestEnv();
      const res = await app.request(
        "http://localhost/api/orgs/missing-org/tags",
        {},
        env as any,
      );

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: "Org not found" });
    });
  });

  describe("DELETE /api/orgs/:slug/members/:userId", () => {
    it("returns 403 when an admin tries to remove an owner", async () => {
      const token = await createTestJWT({
        sub: "admin-user",
        githubId: "123",
        name: "Admin Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };

      queueSelectResponses([
        { getResult: org },
        { getResult: { orgId: "org-1", userId: "admin-user", role: "admin" } }, // requireOrgAdmin
        { getResult: { orgId: "org-1", userId: "owner-user", role: "owner" } }, // getOrgMembership (target)
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/owner-user",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(403);
      expect(((await res.json()) as any).error).toBe(
        "Forbidden: admin cannot remove owner",
      );
    });
    it("returns 404 when the target membership does not exist", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(404);
      expect(((await res.json()) as any).error).toBe("Member not found");
    });
  });

  describe("DELETE /api/orgs/:slug/papers/:paperId", () => {
    it("deletes the association for admins", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Admin",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        { getResult: null }, // not author
        { getResult: { paperId: "paper-1", orgId: "org-1" } }, // existing association
      ]);

      const deleteWhere = vi.fn(async () => ({ meta: { changes: 1 } }));
      mockDb.delete = vi.fn(() => ({ where: deleteWhere }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers/paper-1",
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

    it("returns 403 when not org admin or paper author", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: null }, // not admin
        { getResult: null }, // not paper author
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers/paper-1",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        error: "Forbidden: must be org admin or paper author",
      });
    });

    it("returns 404 when the association does not exist", async () => {
      const token = await createTestJWT({
        sub: "user-2",
        githubId: "456",
        name: "Author",
      });
      queueSelectResponses([
        { getResult: { id: "org-1", slug: "my-lab" } },
        { getResult: null },
        {
          getResult: { paperId: "paper-1", userId: "user-2", role: "uploader" },
        },
        { getResult: null },
      ]);

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/papers/paper-1",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(404);
      expect(((await res.json()) as any).error).toBe(
        "Paper is not associated with this org",
      );
    });
  });

  // ─── Boundary: last admin protection ──────────────────────
  describe("last admin protection", () => {
    it("PATCH prevents demoting the last admin", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return makeQuery({ getResult: org });
        // actor is admin
        if (selectCallCount === 2)
          return makeQuery({
            getResult: { orgId: "org-1", userId: "user-1", role: "admin" },
          });
        // target is also admin
        if (selectCallCount === 3)
          return makeQuery({
            getResult: { orgId: "org-1", userId: "user-2", role: "admin" },
          });
        return makeQuery({ getResult: null });
      });

      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => ({ meta: { changes: 0 } })),
        })),
      }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
        env as any,
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("last admin");
    });

    it("DELETE prevents removing the last admin", async () => {
      const token = await createTestJWT({
        sub: "user-1",
        githubId: "123",
        name: "Tester",
      });
      const org = { id: "org-1", slug: "my-lab" };
      let selectCallCount = 0;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        if (selectCallCount === 1) return makeQuery({ getResult: org });
        // actor is admin
        if (selectCallCount === 2)
          return makeQuery({
            getResult: { orgId: "org-1", userId: "user-1", role: "admin" },
          });
        // target is also admin
        if (selectCallCount === 3)
          return makeQuery({
            getResult: { orgId: "org-1", userId: "user-2", role: "admin" },
          });
        return makeQuery({ getResult: null });
      });

      mockDb.delete = vi.fn(() => ({
        where: vi.fn(async () => ({ meta: { changes: 0 } })),
      }));

      const app = await createTestApp();
      const env = createTestEnv();

      const res = await app.request(
        "http://localhost/api/orgs/my-lab/members/user-2",
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        env as any,
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("last admin");
    });
  });
});
