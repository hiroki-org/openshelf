import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    createTestEnv,
    createTestJWT,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

function createMockDb(overrides: Record<string, any> = {}) {
    return {
        run: vi.fn(async () => undefined),
        select: vi.fn(() => makeQuery()),
        insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
        })),
        delete: vi.fn(() => ({
            where: vi.fn(async () => undefined),
        })),
        ...overrides,
    };
}

describe("orgs routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = createMockDb();
    });

    // ─── POST /api/orgs ────────────────────────────────────────
    describe("POST /api/orgs", () => {
        it("creates org and returns 201", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            const createdOrg = { id: "org-1", slug: "my-lab", name: "My Lab", description: null, createdAt: "2026-01-01" };
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

        it("returns 400 for invalid slug", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });

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
    });

    // ─── GET /api/orgs/:slug ──────────────────────────────────
    describe("GET /api/orgs/:slug", () => {
        it("returns org detail", async () => {
            const org = { id: "org-1", slug: "my-lab", name: "My Lab", description: null, createdAt: "2026-01-01" };
            mockDb.select = vi.fn(() => makeQuery({ getResult: org }));

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

    // ─── DELETE /api/orgs/:slug ────────────────────────────────
    describe("DELETE /api/orgs/:slug", () => {
        it("returns 403 if not admin", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            const org = { id: "org-1", slug: "my-lab" };
            let selectCallCount = 0;
            mockDb.select = vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return makeQuery({ getResult: org });
                // membership check: member, not admin
                return makeQuery({ getResult: { orgId: "org-1", userId: "user-1", role: "member" } });
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
    });

    // ─── Member management ────────────────────────────────────
    describe("POST /api/orgs/:slug/members", () => {
        it("returns 401 without auth", async () => {
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
    });

    describe("PATCH /api/orgs/:slug/members/:userId", () => {
        it("returns 400 for invalid role", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            const org = { id: "org-1", slug: "my-lab" };
            let selectCallCount = 0;
            mockDb.select = vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return makeQuery({ getResult: org });
                return makeQuery({ getResult: { orgId: "org-1", userId: "user-1", role: "admin" } });
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
    });

    // ─── Paper association ────────────────────────────────────
    describe("POST /api/orgs/:slug/papers", () => {
        it("returns 401 without auth", async () => {
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
    });
});
