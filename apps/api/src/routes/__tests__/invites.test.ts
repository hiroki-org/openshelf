import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    createTestEnv,
    createTestJWT,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb)
}));

describe("invites routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
            batch: vi.fn(async () => undefined)
        };
    });

    it("POST /api/papers/:id/invites sends coauthor invite", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }))
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-2" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/papers/paper-1/invites",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inviteeId: "user-2" })
            },
            env as any
        );

        expect(res.status).toBe(201);
    });

    it("GET /api/invites/received returns invites", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Invitee" });
        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ id: "inv-1", paperId: "paper-1", paperTitle: "Paper", status: "pending" }] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/invites/received",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.invites).toHaveLength(1);
    });

    it("PUT /api/invites/:id accepts invite", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Invitee" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "inv-1", inviteeId: "user-2", paperId: "paper-1", status: "pending" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/invites/inv-1",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action: "accept" })
            },
            env as any
        );

        expect(res.status).toBe(200);
    });

    it("PUT /api/invites/:id declines invite", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Invitee" });
        mockDb.select = vi.fn(() => makeQuery({ getResult: { id: "inv-1", inviteeId: "user-2", paperId: "paper-1", status: "pending" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/invites/inv-1",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action: "decline" })
            },
            env as any
        );

        expect(res.status).toBe(200);
    });

    it("PUT /api/invites/:id returns 400 for invalid JSON", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Invitee" });

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/invites/inv-1",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: "{ invalid }"
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body).toEqual({ error: "Invalid JSON body" });
    });

    it("POST /api/papers/:id/invites returns 400 when inviting self", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/papers/paper-1/invites",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inviteeId: "user-1" })
            },
            env as any
        );

        expect(res.status).toBe(400);
    });
});
