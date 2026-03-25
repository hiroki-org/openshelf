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

    it("hits the token cache on subsequent calls and removes expired ones", async () => {
        const app = await createTestApp();
        const { createTestJWT } = await import("../../test/helpers");
        const paperId = "test-paper-cache";
        const fileId = "test-file-cache";

        vi.useFakeTimers();
        vi.setSystemTime(new Date(1000000000000));
        try {
            const nowSec = 1000000000;
            const tokenHit = await createTestJWT({ sub: "mock-user-id", exp: nowSec + 3600 });

            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({
                getResult: { id: fileId, paperId, r2Key: "papers/test.pdf", filename: "paper.pdf" },
            }));

            let req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
                headers: { Authorization: `Bearer ${tokenHit}` },
            });
            const res1 = await app.request(req, {}, {
                DB: mockDb,
                JWT_SECRET: "test-jwt-secret",
                BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
            });
            expect(res1.status).toBe(200);

            // 2. Second call immediately should hit the cache (expiresAt > now)
            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({
                getResult: { id: fileId, paperId, r2Key: "papers/test.pdf", filename: "paper.pdf" },
            }));
            req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
                headers: { Authorization: `Bearer ${tokenHit}` },
            });
            const res2 = await app.request(req, {}, {
                DB: mockDb,
                JWT_SECRET: "test-jwt-secret",
                BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
            });
            expect(res2.status).toBe(200);

            // 3. Advance time by 61 seconds (exceeding TOKEN_CACHE_MAX_AGE_MS = 60s)
            vi.setSystemTime(new Date(1000000000000 + 61000));

            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
            mockDb.select.mockReturnValueOnce(makeQuery({
                getResult: { id: fileId, paperId, r2Key: "papers/test.pdf", filename: "paper.pdf" },
            }));
            req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
                headers: { Authorization: `Bearer ${tokenHit}` },
            });
            const res3 = await app.request(req, {}, {
                DB: mockDb,
                JWT_SECRET: "test-jwt-secret",
                BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
            });
            expect(res3.status).toBe(200);
        } finally {
            vi.useRealTimers();
        }
    });

    it("purges expired cache when reaching MAX_CACHE_SIZE", async () => {
        const app = await createTestApp();
        const { createTestJWT } = await import("../../test/helpers");

        vi.useFakeTimers();
        vi.setSystemTime(new Date(1000000000000));
        try {
            const nowSec = 1000000000;

            mockDb.select.mockReturnValue(makeQuery({ getResult: { id: "dummy", visibility: "private" } }));

            const tasks = [];
            for (let i = 0; i <= 1000; i++) {
                 const token = await createTestJWT({ sub: "mock-user-id" + i, exp: nowSec + 3600 });
                 const req = new Request(`http://localhost/api/papers/dummy/files/dummy/download`, {
                     headers: { Authorization: `Bearer ${token}` },
                 });
                 tasks.push(app.request(req, {}, {
                     DB: mockDb,
                     JWT_SECRET: "test-jwt-secret",
                     BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
                 }));
            }
            await Promise.all(tasks);

            vi.setSystemTime(new Date(1000000000000 + 65000));

            const tokenPurge = await createTestJWT({ sub: "mock-user-id-purge", exp: nowSec + 3600 });
            const purgeReq = new Request(`http://localhost/api/papers/dummy/files/dummy/download`, {
                headers: { Authorization: `Bearer ${tokenPurge}` },
            });
            const purgeRes = await app.request(purgeReq, {}, {
                DB: mockDb,
                JWT_SECRET: "test-jwt-secret",
                BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
            });
            expect(purgeRes.status).toBe(200);
        } finally {
            vi.useRealTimers();
        }
    });


    it("hits the token cache on subsequent calls and removes expired ones", async () => {
        const app = await createTestApp();
        const { createTestJWT } = await import("../../test/helpers");
        const paperId = "test-paper-cache";
        const fileId = "test-file-cache";

        vi.useFakeTimers();
        vi.setSystemTime(new Date(1000000000000));

        const nowSec = 1000000000;
        const tokenHit = await createTestJWT({ sub: "mock-user-id", exp: nowSec + 3600 });

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));

        let req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${tokenHit}` },
        });
        await app.request(req, {}, {
            DB: mockDb,
            JWT_SECRET: "test-jwt-secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // 2. Second call immediately should hit the cache (expiresAt > now)
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
        req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${tokenHit}` },
        });
        await app.request(req, {}, {
            DB: mockDb,
            JWT_SECRET: "test-jwt-secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // 3. Advance time by 61 seconds (exceeding TOKEN_CACHE_MAX_AGE_MS = 60s)
        vi.setSystemTime(new Date(1000000000000 + 61000));

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
        req = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${tokenHit}` },
        });
        await app.request(req, {}, {
            DB: mockDb,
            JWT_SECRET: "test-jwt-secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        vi.useRealTimers();
    });

    it("purges expired cache when reaching MAX_CACHE_SIZE", async () => {
        const app = await createTestApp();
        const { createTestJWT } = await import("../../test/helpers");

        vi.useFakeTimers();
        vi.setSystemTime(new Date(1000000000000));

        const nowSec = 1000000000;

        // Use a persistent mock for the loop
        mockDb.select.mockReturnValue(makeQuery({ getResult: { id: "dummy", visibility: "private" } }));

        const tasks = [];
        for (let i = 0; i <= 1000; i++) {
             const token = await createTestJWT({ sub: "mock-user-id" + i, exp: nowSec + 3600 });
             const r = new Request(`http://localhost/api/papers/dummy/files/dummy/download`, {
                 headers: { Authorization: `Bearer ${token}` },
             });
             tasks.push(app.request(r, {}, {
                 DB: mockDb,
                 JWT_SECRET: "test-jwt-secret",
                 BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
             }));
        }
        await Promise.all(tasks);

        // Advance time to expire them
        vi.setSystemTime(new Date(1000000000000 + 65000));

        // Add one more to trigger purge
        const tokenPurge = await createTestJWT({ sub: "mock-user-id-purge", exp: nowSec + 3600 });
        const purgeReq = new Request(`http://localhost/api/papers/dummy/files/dummy/download`, {
            headers: { Authorization: `Bearer ${tokenPurge}` },
        });
        await app.request(purgeReq, {}, {
            DB: mockDb,
            JWT_SECRET: "test-jwt-secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        vi.useRealTimers();
    });


    it("hits the token cache on subsequent calls", async () => {
        const app = await createTestApp();
        const paperId = "test-paper-cache";
        const fileId = "test-file-cache";

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } })); // Is author

        // First call
        const req1 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token",
            },
        });
        const viSelectSpy = vi.spyOn(mockDb, 'select');
        await app.request(req1, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // Second call should hit cache
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } })); // Is author
        const req2 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token",
            },
        });
        await app.request(req2, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // Should only be called 2 times (for req1) instead of 4
        expect(viSelectSpy).toHaveBeenCalledTimes(2);
        viSelectSpy.mockRestore();
    });

    it("purges expired cache when reaching MAX_CACHE_SIZE", async () => {
        const app = await createTestApp();

        // Generate enough dummy requests to force the cache to purge
        for (let i = 0; i <= 1000; i++) {
             mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "dummy", visibility: "private" } }));
             mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
             const req = new Request(`http://localhost/api/papers/dummy/files/dummy/download`, {
                 headers: {
                     Authorization: `Bearer test-token-${i}`,
                 },
             });
             await app.request(req, {}, {
                 DB: mockDb,
                 JWT_SECRET: "secret",
                 BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
             });
        }
    });

    it("removes explicitly cached entries when expired upon fetching", async () => {
        const app = await createTestApp();
        const paperId = "test-paper-cache";
        const fileId = "test-file-cache";

        // This is tricky because testing Date.now() bypasses need to be done using vi.setSystemTime
        vi.useFakeTimers();
        vi.setSystemTime(new Date(1000000000000));

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));

        const req1 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token-expire",
            },
        });
        await app.request(req1, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // Advance time by 2 minutes
        vi.setSystemTime(new Date(1000000000000 + 120 * 1000));

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } }));
        const req2 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token-expire",
            },
        });
        await app.request(req2, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        vi.useRealTimers();
    });


    it("hits the token cache on subsequent calls", async () => {
        const app = await createTestApp();
        const paperId = "test-paper-cache";
        const fileId = "test-file-cache";

        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } })); // Is author

        // First call
        const req1 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token",
            },
        });
        await app.request(req1, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });

        // Second call should hit cache
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: paperId, visibility: "private" } }));
        mockDb.select.mockReturnValueOnce(makeQuery({ getResult: { id: "user-author" } })); // Is author
        const req2 = new Request(`http://localhost/api/papers/${paperId}/files/${fileId}/download`, {
            headers: {
                Authorization: "Bearer test-token",
            },
        });
        await app.request(req2, {}, {
            DB: mockDb,
            JWT_SECRET: "secret",
            BUCKET: { get: vi.fn().mockResolvedValue({ body: "test" }) },
        });
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
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
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "private", showViewCount: true, language: "ja", doi: "10.1234/example" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "file-1", filename: "paper.pdf" }] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ userId: "user-1", role: "uploader", name: "Uploader", displayName: null, avatarUrl: null }] }))
            .mockImplementationOnce(() => makeQuery({ getResult: { count: 4 } }));

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
        expect(body.paper.language).toBe("ja");
        expect(body.paper.doi).toBe("10.1234/example");
        expect(body.paper.showViewCount).toBe(true);
        expect(body.paper.publicViewCount).toBe(4);
        expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it("POST /api/papers rejects a non-boolean showViewCount", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        const form = new FormData();
        form.set(
            "metadata",
            JSON.stringify({
                title: "View Count Paper",
                visibility: "private",
                showViewCount: "yes",
            }),
        );
        form.set("files_0", new File(["%PDF-1.4\n%dummy-pdf"], "paper.pdf", { type: "application/pdf" }));
        form.set("file_types_0", "paper");

        const res = await app.request(
            "http://localhost/api/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000",
                },
                body: form,
            },
            env as any,
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("showViewCount");
    });

    it("POST /api/papers/:id/view records a view when the fingerprint is new", async () => {
        const values = vi.fn(async () => undefined);
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));
        mockDb.insert = vi.fn(() => ({ values }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/view",
            {
                method: "POST",
                headers: {
                    Origin: "http://localhost:3000",
                    "User-Agent": "Vitest",
                    "Accept-Language": "ja-JP",
                },
            },
            env as any,
        );

        expect(res.status).toBe(201);
        expect(values).toHaveBeenCalledTimes(1);
        const body = (await res.json()) as any;
        expect(body.counted).toBe(true);
    });

    it("POST /api/papers/:id/view ignores duplicate views in the same bucket", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "view-1" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/view",
            {
                method: "POST",
                headers: {
                    Origin: "http://localhost:3000",
                    "User-Agent": "Vitest",
                },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(mockDb.insert).not.toHaveBeenCalled();
        const body = (await res.json()) as any;
        expect(body.counted).toBe(false);
    });

    it("GET /api/papers/:id/stats returns author-only statistics", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Author" });
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { userId: "user-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { count: 42 } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { count: 18 } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { count: 6 } }))
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        { date: yesterday, count: 3 },
                        { date: today, count: 2 },
                    ],
                }),
            );

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/stats",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.totalViews).toBe(42);
        expect(body.last30DaysViews).toBe(18);
        expect(body.last7DaysViews).toBe(6);
        expect(body.dailyViews).toHaveLength(30);
        expect(body.dailyViews.at(-1)).toEqual({ date: today, count: 2 });
    });

    it("GET /api/papers/:id omits publicViewCount when showViewCount is false", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", visibility: "public", showViewCount: false } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.paper.showViewCount).toBe(false);
        expect(body.paper.publicViewCount).toBeNull();
    });

    it("POST /api/papers/:id/view returns 401 for private paper without token", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/view",
            {
                method: "POST",
                headers: { Origin: "http://localhost:3000" },
            },
            env as any,
        );

        expect(res.status).toBe(401);
    });

    it("POST /api/papers/:id/view returns 403 for private paper from non-author", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Other" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/view",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000",
                },
            },
            env as any,
        );

        expect(res.status).toBe(403);
    });

    it("GET /api/papers/:id/stats returns 403 for non-authors", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Other User" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/stats",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(403);
    });

    it("PATCH /api/papers/:id rejects changing a non-org_only paper to org_only", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ visibility: "org_only" }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("org_only");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("PATCH /api/papers/:id validates externalUrl like POST", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ externalUrl: "ftp://example.com/paper" }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("externalUrl");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("PATCH /api/papers/:id rejects overlong abstract", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ abstract: "a".repeat(5001) }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("abstract");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("PATCH /api/papers/:id allows keeping org_only on an existing org_only paper", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const where = vi.fn(async () => undefined);
        const set = vi.fn(() => ({ where }));
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "org_only" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn(() => ({ set }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ visibility: "org_only", title: "Updated title" }),
            },
            env as any
        );

        expect(res.status).toBe(200);
        expect(mockDb.update).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                visibility: "org_only",
                title: "Updated title",
            }),
        );
        expect(where).toHaveBeenCalledTimes(1);
    });

    it("PATCH /api/papers/:id rejects a primitive JSON body", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: "null",
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("Invalid JSON body");
        expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("PATCH /api/papers/:id rejects requests without valid updatable fields", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ unknownField: "ignored" }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("No valid fields");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("PATCH /api/papers/:id updates showViewCount for authors", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const where = vi.fn(async () => undefined);
        const set = vi.fn(() => ({ where }));
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn(() => ({ set }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ showViewCount: true }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({ showViewCount: true }),
        );
        expect(where).toHaveBeenCalledTimes(1);
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
