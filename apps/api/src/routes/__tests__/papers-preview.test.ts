import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    createTestEnv,
    makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

describe("papers preview routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
            delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
            batch: vi.fn(async (queries) => Promise.all(queries.map((q: any) => (q.all ? q.all() : q)))),
        };
    });

    it("GET /api/papers/:id/files/:fileId/preview returns signed URL for public paper without auth", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }))
            .mockImplementationOnce(
                () =>
                    makeQuery({
                        getResult: {
                            id: "file-1",
                            paperId: "paper-1",
                            r2Key: "papers/paper-1/paper/sample.pdf",
                            mimeType: "application/pdf",
                            filename: "sample.pdf",
                        },
                    }),
            );

        const app = await createTestApp();
        const env = createTestEnv({
            BUCKET: {
                put: vi.fn(async () => undefined),
                delete: vi.fn(async () => undefined),
                get: vi.fn(async () => null),
                createSignedUrl: vi.fn(async () => "https://signed.example/paper.pdf?sig=test"),
            } as any,
        });

        const res = await app.request(
            "http://localhost/api/papers/paper-1/files/file-1/preview",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.url).toContain("https://signed.example");
        expect(body.mimeType).toBe("application/pdf");
        expect(body.filename).toBe("sample.pdf");
    });

    it("GET /api/papers/:id/files/:fileId/preview returns 401 for private paper without auth", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/papers/paper-1/files/file-1/preview",
            {},
            env as any,
        );

        expect(res.status).toBe(401);
    });

    it("GET /api/papers/:id/files/:fileId/preview falls back to stream URL when signed URL generation fails", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }))
            .mockImplementationOnce(
                () =>
                    makeQuery({
                        getResult: {
                            id: "file-1",
                            paperId: "paper-1",
                            r2Key: "papers/paper-1/paper/sample.pdf",
                            mimeType: "application/pdf",
                            filename: "sample.pdf",
                        },
                    }),
            );

        const app = await createTestApp();
        const env = createTestEnv({
            BUCKET: {
                put: vi.fn(async () => undefined),
                delete: vi.fn(async () => undefined),
                get: vi.fn(async () => null),
                createSignedUrl: vi.fn(async () => {
                    throw new Error("presign failed");
                }),
            } as any,
        });

        const res = await app.request(
            "http://localhost/api/papers/paper-1/files/file-1/preview",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.url).toBe("/api/papers/paper-1/files/file-1/stream");
        expect(body.mimeType).toBe("application/pdf");
        expect(body.filename).toBe("sample.pdf");
    });
});
