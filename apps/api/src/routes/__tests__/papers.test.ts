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

describe("papers routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
            delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
            batch: vi.fn(async (queries) => Promise.all(queries.map((q: any) => q.all ? q.all() : q)))
        };
    });

    it("POST /api/papers uploads multipart and creates paper", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        const form = new FormData();
        form.set("metadata", JSON.stringify({ title: "Test Paper", visibility: "private" }));
        form.set("files_0", new File(["%PDF-1.4\n%dummy-pdf"], "paper.pdf", { type: "application/pdf" }));
        form.set("file_types_0", "paper");

        const res = await app.request(
            "http://localhost/api/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000"
                },
                body: form
            },
            env as any
        );


        expect(res.status).toBe(201);
    });

    it("POST /api/papers rejects upload when content does not match declared MIME", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        const form = new FormData();
        form.set("metadata", JSON.stringify({ title: "Mismatched Paper", visibility: "private" }));
        // PDF declared but content starts with ZIP header
        form.set("files_0", new File(["PK\x03\x04zipcontent"], "paper.pdf", { type: "application/pdf" }));
        form.set("file_types_0", "paper");

        const res = await app.request(
            "http://localhost/api/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000"
                },
                body: form
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("does not match expected format");
    });

    it("GET /api/papers returns current user's papers", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn(() => makeQuery({ allResult: [{ paper: { id: "paper-1", title: "P1" } }] }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers",
            {
                headers: { Authorization: `Bearer ${token}` }
            },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.papers[0].id).toBe("paper-1");
    });

    it("GET /api/papers/:id returns paper details", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "file-1", filename: "paper.pdf" }] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ userId: "user-1", role: "uploader", name: "Uploader", displayName: null, avatarUrl: null }] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ count: 0 }] }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.paper.id).toBe("paper-1");
        expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it("GET /api/papers/:id returns 401 for private paper without Bearer token", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "private" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request("http://localhost/api/papers/paper-1", {}, env as any);

        expect(res.status).toBe(401);
    });

    it("GET /api/papers/:id returns 403 for private paper when requester is not an author", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Other User" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any
        );

        expect(res.status).toBe(403);
    });

    it("GET /api/papers/:id returns 500 (not 401) on database error during author check", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "private" } }))
            .mockImplementationOnce(() => { throw new Error("DB Error") });

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any
        );

        expect(res.status).toBe(500);
    });

    it("DELETE /api/papers/:id deletes a paper", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ r2Key: "papers/paper-1/paper/file.pdf" }] }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000"
                }
            },
            env as any
        );


        expect(res.status).toBe(200);
    });

    it("GET /api/papers/:id returns 404 when paper does not exist", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request("http://localhost/api/papers/not-found", {}, env as any);

        expect(res.status).toBe(404);
    });
});
