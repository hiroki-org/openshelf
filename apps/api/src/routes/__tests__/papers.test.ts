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
        form.set("files_0", new File(["paper-body"], "paper.pdf", { type: "application/pdf" }));
        form.set("file_types_0", "paper");

        const res = await app.request(
            "http://localhost/api/papers",
            {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form
            },
            env as any
        );

        expect(res.status).toBe(201);
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
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "public" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "file-1", filename: "paper.pdf" }] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ userId: "user-1", role: "uploader", name: "Uploader", displayName: null, avatarUrl: null }] }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request("http://localhost/api/papers/paper-1", {}, env as any);

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.paper.id).toBe("paper-1");
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
                headers: { Authorization: `Bearer ${token}` }
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
