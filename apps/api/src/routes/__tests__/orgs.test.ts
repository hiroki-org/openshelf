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

        it("returns 400 for invalid JSON bodies", async () => {
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
            const org = { id: "org-1", slug: "my-lab", name: "My Lab", description: null, createdAt: "2026-01-01" };
            queueSelectResponses([
                { getResult: org },
                { getResult: { count: 3 } },
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
        it("updates the org for admins", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab", name: "My Lab", description: null } },
                { getResult: { orgId: "org-1", userId: "user-1", role: "owner" } },
                { getResult: { id: "org-1", slug: "my-lab", name: "Renamed Lab", description: "Updated" } },
            ]);

            const setValues = vi.fn(() => ({ where: vi.fn(async () => ({ meta: { changes: 1 } })) }));
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab", name: "My Lab", description: null } },
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

        it("deletes the org for admins", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
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
            expect(((await res.json()) as any).error).toBe("User is already a member");
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
            const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Author" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab" } },
                { getResult: { id: "paper-1", title: "Paper" } },
                { getResult: null },
                { getResult: { paperId: "paper-1", userId: "user-2", role: "uploader" } },
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Admin" });
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Member" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab" } },
                { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
                {
                    allResult: [
                        { paperId: "paper-public" },
                        { paperId: "paper-org" },
                        { paperId: "paper-private" },
                    ],
                },
                {
                    allResult: [
                        { id: "paper-public", title: "Public", visibility: "public" },
                        { id: "paper-org", title: "Org", visibility: "org_only" },
                        { id: "paper-private", title: "Private", visibility: "private" },
                    ],
                },
                { allResult: [] },
            ]);

            const app = await createTestApp();
            const env = createTestEnv();

            const res = await app.request(
                "http://localhost/api/orgs/my-lab/papers",
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
                env as any,
            );

            expect(res.status).toBe(200);
            expect(((await res.json()) as any).papers.map((paper: any) => paper.id)).toEqual([
                "paper-public",
                "paper-org",
            ]);
        });

        it("returns authored private papers even when the requester is not an org member", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Author" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab" } },
                { getResult: null },
                {
                    allResult: [
                        { paperId: "paper-public" },
                        { paperId: "paper-private" },
                    ],
                },
                {
                    allResult: [
                        { id: "paper-public", title: "Public", visibility: "public" },
                        { id: "paper-private", title: "Private", visibility: "private" },
                    ],
                },
                { allResult: [{ paperId: "paper-private" }] },
            ]);

            const app = await createTestApp();
            const env = createTestEnv();

            const res = await app.request(
                "http://localhost/api/orgs/my-lab/papers",
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
                env as any,
            );

            expect(res.status).toBe(200);
            expect(((await res.json()) as any).papers.map((paper: any) => paper.id)).toEqual([
                "paper-public",
                "paper-private",
            ]);
        });
    });

    describe("DELETE /api/orgs/:slug/members/:userId", () => {
        it("returns 404 when the target membership does not exist", async () => {
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
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
        it("returns 404 when the association does not exist", async () => {
            const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Author" });
            queueSelectResponses([
                { getResult: { id: "org-1", slug: "my-lab" } },
                { getResult: null },
                { getResult: { paperId: "paper-1", userId: "user-2", role: "uploader" } },
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            const org = { id: "org-1", slug: "my-lab" };
            let selectCallCount = 0;
            mockDb.select = vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return makeQuery({ getResult: org });
                // actor is admin
                if (selectCallCount === 2) return makeQuery({ getResult: { orgId: "org-1", userId: "user-1", role: "admin" } });
                // target is also admin
                if (selectCallCount === 3) return makeQuery({ getResult: { orgId: "org-1", userId: "user-2", role: "admin" } });
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
            const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Tester" });
            const org = { id: "org-1", slug: "my-lab" };
            let selectCallCount = 0;
            mockDb.select = vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return makeQuery({ getResult: org });
                // actor is admin
                if (selectCallCount === 2) return makeQuery({ getResult: { orgId: "org-1", userId: "user-1", role: "admin" } });
                // target is also admin
                if (selectCallCount === 3) return makeQuery({ getResult: { orgId: "org-1", userId: "user-2", role: "admin" } });
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
