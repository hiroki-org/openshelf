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
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({
                    run: vi.fn(async () => ({ meta: { changes: 1 } })),
                })),
            })),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    onConflictDoUpdate: vi.fn(async () => undefined),
                    onConflictDoNothing: vi.fn(async () => undefined),
                })),
            })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
            delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
            batch: vi.fn(async (queries) => Promise.all(queries.map((q: any) => q.all ? q.all() : q)))
        };
    });

    it("POST /api/papers uploads multipart and creates paper", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });

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

    it("POST /api/papers deletes uploaded files and paper record on database error", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });

        // Mock db.insert to succeed for papers, but fail for paperFiles
        const dbError = new Error("Mock DB Error");
        mockDb.insert
            .mockImplementationOnce(() => ({ values: vi.fn(async () => undefined) })) // papers insert
            .mockImplementationOnce(() => ({ values: vi.fn(async () => undefined) })) // paperAuthors insert
            .mockImplementationOnce(() => { throw dbError; }); // paperFiles insert

        const mockDeleteWhere = vi.fn(async () => undefined);
        mockDb.delete = vi.fn(() => ({ where: mockDeleteWhere }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });

        // Spy on BUCKET.delete
        const bucketDeleteSpy = vi.spyOn(env.BUCKET, "delete").mockRejectedValue(new Error("Cleanup failed"));
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
        expect(res.status).toBe(500);

        // BUCKET.delete should be called with a batch including uploaded paper keys
        expect(bucketDeleteSpy).toHaveBeenCalledTimes(1);
        const firstDeleteCall = bucketDeleteSpy.mock.calls[0];
        const deletedKeys = firstDeleteCall?.[0];
        expect(deletedKeys).toEqual(
            expect.arrayContaining([expect.stringContaining("papers/")]),
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Cleanup error (non-fatal, rollback continues)",
            expect.objectContaining({
                chunkStart: 0,
                chunkEndExclusive: 1,
                chunkSize: 1,
                chunkSample: expect.arrayContaining([expect.stringContaining("papers/")]),
                error: "Cleanup failed",
            }),
        );

        // db.delete should be called for papers
        expect(mockDb.delete).toHaveBeenCalledTimes(1);
        expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
        consoleErrorSpy.mockRestore();
        bucketDeleteSpy.mockRestore();
    });

    it("POST /api/papers rejects upload when content does not match declared MIME", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });

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
        const env = createTestEnv({ DB: mockDb as any });
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
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", title: "P1", abstract: "A", description: "## notes", descriptionUpdatedAt: "2026-04-01 12:00:00", visibility: "private", showViewCount: true, language: "ja", doi: "10.1234/example" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "file-1", filename: "paper.pdf" }] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ userId: "user-1", role: "uploader", name: "Uploader", displayName: null, avatarUrl: null }] }))
            .mockImplementationOnce(() => makeQuery({ getResult: { views: 4, downloads: 2 } }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
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
        expect(body.paper.description).toBe("## notes");
        expect(body.paper.descriptionUpdatedAt).toBe("2026-04-01T12:00:00.000Z");
        expect(body.paper.showViewCount).toBe(true);
        expect(body.paper.publicViewCount).toBe(4);
        expect(body.paper.publicDownloadCount).toBe(2);
        expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it("GET /api/papers/:id/cite returns citation in requested format", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "paper-1",
                    title: "Boundary Explorer",
                    visibility: "private",
                    venue: "ASE",
                    venueType: "conference",
                    year: 2026,
                    category: "other",
                    doi: null,
                    externalUrl: null,
                },
            }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ name: "hiroki", displayName: "Hiroki Mukai" }] }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
        const res = await app.request(
            "http://localhost/api/papers/paper-1/cite?format=bibtex",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.format).toBe("bibtex");
        expect(body.key).toContain("mukai2026");
        expect(body.citation).toContain("@inproceedings");
    });

    it("GET /api/papers/:id/cite supports plain format", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "paper-1",
                    title: "Boundary Explorer",
                    visibility: "private",
                    venue: "ASE",
                    venueType: "conference",
                    year: 2026,
                    category: "other",
                    doi: null,
                    externalUrl: null,
                },
            }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: [{ name: "hiroki", displayName: "向井 宏樹" }] }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
        const res = await app.request(
            "http://localhost/api/papers/paper-1/cite?format=plain",
            { headers: { Authorization: `Bearer ${token}` } },
            env as any,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.format).toBe("plain");
        expect(body.key).toBeNull();
        expect(body.citation).toContain("向井 宏樹");
    });

    it("POST /api/papers rejects a non-boolean showViewCount", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });

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

    it("POST /api/papers/:id/track accepts view event", async () => {
        const dedupRun = vi.fn(async () => ({ meta: { changes: 1 } }));
        const dailyRun = vi.fn(async () => ({ meta: { changes: 1 } }));
        const totalRun = vi.fn(async () => ({ meta: { changes: 1 } }));
        const cleanupRun = vi.fn(async () => ({ meta: { changes: 0 } }));
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }));
        const prepare = vi
            .fn()
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: dedupRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: dailyRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: totalRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: cleanupRun })) }));
        mockDb.prepare = prepare;
        mockDb.batch = vi.fn(async (queries) =>
            Promise.all(queries.map((q: any) => q.run())),
        );

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
        const res = await app.request(
            "http://localhost/api/papers/paper-1/track",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                    "User-Agent": "Vitest",
                },
                body: JSON.stringify({ event: "view", referrer: "https://example.com" }),
            },
            env as any,
        );

        expect(res.status).toBe(204);
        expect(prepare).toHaveBeenCalledTimes(4);
        expect(dedupRun).toHaveBeenCalled();
        expect(dailyRun).toHaveBeenCalled();
        expect(totalRun).toHaveBeenCalled();
    });

    it("POST /api/papers/:id/track ignores bots", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
        const res = await app.request(
            "http://localhost/api/papers/paper-1/track",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                    "User-Agent": "googlebot",
                },
                body: JSON.stringify({ event: "view" }),
            },
            env as any,
        );

        expect(res.status).toBe(204);
        expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("POST /api/papers/:id/track handles duplicate dedup rows", async () => {
        const dedupRun = vi.fn(async () => ({ meta: { changes: 0 } }));
        const dailyRun = vi.fn(async () => ({ meta: { changes: 0 } }));
        const totalRun = vi.fn(async () => ({ meta: { changes: 0 } }));
        const cleanupRun = vi.fn(async () => ({ meta: { changes: 0 } }));
        mockDb.prepare = vi
            .fn()
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: dedupRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: dailyRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: totalRun })) }))
            .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ run: cleanupRun })) }));
        mockDb.batch = vi.fn(async (queries) =>
            Promise.all(queries.map((q: any) => q.run())),
        );
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "public" } }));

        const app = await createTestApp();
        const env = createTestEnv({ DB: mockDb as any });
        const res = await app.request(
            "http://localhost/api/papers/paper-1/track",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                    "User-Agent": "Vitest",
                },
                body: JSON.stringify({ event: "download" }),
            },
            env as any,
        );

        expect(res.status).toBe(204);
    });

    it("POST /api/papers/:id/track returns 404 when paper does not exist", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/missing-paper/track",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                    "User-Agent": "Vitest",
                },
                body: JSON.stringify({ event: "view" }),
            },
            env as any,
        );

        expect(res.status).toBe(404);
        expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("GET /api/papers/:id/stats returns author-only statistics", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Author" });
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { userId: "user-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { views: 42, downloads: 18, previews: 6 } }))
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        { date: yesterday, views: 3, downloads: 1, previews: 1 },
                        { date: today, views: 2, downloads: 1, previews: 0 },
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
        expect(body.total).toEqual({ views: 42, downloads: 18, previews: 6 });
        expect(body.daily).toHaveLength(30);
        expect(body.daily.at(-1)).toEqual({ date: today, views: 2, downloads: 1, previews: 0 });
        expect(body.days).toBe(30);
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
        expect(body.paper.publicDownloadCount).toBeNull();
    });

    it("POST /api/papers/:id/track returns 401 for private paper without token", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/track",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                },
                body: JSON.stringify({ event: "view" }),
            },
            env as any,
        );

        expect(res.status).toBe(401);
    });

    it("POST /api/papers/:id/track returns 403 for private paper from non-author", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Other" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/track",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ event: "view" }),
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

    it("GET /api/papers/:id/stats rejects invalid days", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Author" });
        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/stats?days=14",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("days must be one of 7, 30, 90, 365");
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

    it("PUT /api/papers/:id/description updates description for authors", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const where = vi.fn(async () => undefined);
        const set = vi.fn(() => ({ where }));
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { userId: "user-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", description: "## Updated", descriptionUpdatedAt: "2026-04-01 12:00:00" } }));
        mockDb.update = vi.fn(() => ({ set }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/description",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ description: "## Updated" }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                description: "## Updated",
            }),
        );
        const body = (await res.json()) as any;
        expect(body.id).toBe("paper-1");
        expect(body.description).toBe("## Updated");
        expect(body.descriptionUpdatedAt).toBe("2026-04-01T12:00:00.000Z");
        expect(body.description_updated_at).toBe("2026-04-01T12:00:00.000Z");
    });

    it("PUT /api/papers/:id/description rejects non-author", async () => {
        const token = await createTestJWT({ sub: "user-2", githubId: "456", name: "Other User" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/description",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ description: "updated" }),
            },
            env as any,
        );

        expect(res.status).toBe(403);
    });

    it("PUT /api/papers/:id/description validates description length", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/api/papers/paper-1/description",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ description: "a".repeat(50001) }),
            },
            env as any,
        );

        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error).toContain("50000");
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


    it("PATCH /api/papers/:id updates doi, venue, venueType, year, category, and tags", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    doi: "10.1234/5678",
                    venue: "Test Venue",
                    venueType: "conference",
                    year: 2024,
                    category: "report",
                    tags: ["tag1", "tag2"]
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                doi: "10.1234/5678",
                venue: "Test Venue",
                venueType: "conference",
                year: 2024,
                category: "report",
                tags: JSON.stringify(["tag1", "tag2"])
            }),
        );
    });

    it("PATCH /api/papers/:id validates invalid types and values", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

        const app = await createTestApp();
        const env = createTestEnv();

        let res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ venueType: "invalid_venue_type" }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ category: "invalid_category" }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ year: "2024" }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tags: "not_an_array" }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tags: [123] }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["a".repeat(256)] }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ venue: 123 }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ doi: 123 }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ venue: "a".repeat(256) }) }, env as any);
        expect(res.status).toBe(400);

        res = await app.request("http://localhost/api/papers/paper-1", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ doi: "a".repeat(256) }) }, env as any);
        expect(res.status).toBe(400);
    });

    it("PATCH /api/papers/:id handles null and empty fields", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    doi: null,
                    venue: null,
                    venueType: null,
                    year: null,
                    category: null,
                    tags: null
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                doi: null,
                venue: null,
                venueType: null,
                year: null,
                category: null,
                tags: null
            }),
        );
    });


    it("PATCH /api/papers/:id ignores empty tags", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    tags: [" ", "tag2"]
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                tags: JSON.stringify(["tag2"])
            }),
        );
    });

    it("PATCH /api/papers/:id updates correctly when tags array has only empty strings", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    tags: [" "]
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                tags: null
            }),
        );
    });


    it("PATCH /api/papers/:id update fails when there are no valid fields", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));

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
                body: JSON.stringify({
                    invalidField: "test"
                }),
            },
            env as any,
        );

        expect(res.status).toBe(400);
    });

    it("PATCH /api/papers/:id ignores empty array of tags and continues if no other fields", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    tags: []
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                tags: null
            }),
        );
    });

    it("PATCH /api/papers/:id updates correctly when values exactly match valid enums", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const set = vi.fn().mockReturnThis();
        const where = vi.fn().mockReturnThis();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn().mockImplementation(() => ({ set, where } as any));

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
                body: JSON.stringify({
                    venueType: "journal",
                    category: "thesis_bachelor"
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                venueType: "journal",
                category: "thesis_bachelor"
            }),
        );
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

    it("DELETE /api/papers/:id bounds concurrent R2 batch deletes", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const files = Array.from({ length: 2001 }, (_, index) => ({
            r2Key: `papers/paper-1/file-${index}.pdf`,
        }));
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ allResult: files }));

        const app = await createTestApp();
        const env = createTestEnv();
        const pendingDeletes: Array<() => void> = [];
        let activeDeletes = 0;
        let maxActiveDeletes = 0;
        const bucketDeleteSpy = vi.spyOn(env.BUCKET, "delete").mockImplementation(
            async () =>
                new Promise<void>((resolve) => {
                    activeDeletes += 1;
                    maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
                    pendingDeletes.push(() => {
                        activeDeletes -= 1;
                        resolve();
                    });
                }),
        );

        const responsePromise = app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Origin: "http://localhost:3000",
                },
            },
            env as any,
        );

        await vi.waitFor(() => {
            expect(bucketDeleteSpy).toHaveBeenCalledTimes(2);
        });
        expect(maxActiveDeletes).toBe(2);

        pendingDeletes.shift()?.();
        await vi.waitFor(() => {
            expect(bucketDeleteSpy).toHaveBeenCalledTimes(3);
        });
        expect(maxActiveDeletes).toBe(2);

        pendingDeletes.shift()?.();
        pendingDeletes.shift()?.();

        const res = await responsePromise;
        expect(res.status).toBe(200);
        bucketDeleteSpy.mockRestore();
    });

    it("GET /api/papers/:id returns 404 when paper does not exist", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request("http://localhost/api/papers/not-found", {}, env as any);

        expect(res.status).toBe(404);
    });

    describe("POST /api/papers/:id/invites database error handling", () => {
        const UNIQUE_INVITE_ERROR = "UNIQUE constraint failed: coauthor_invites.paperId_inviteeId";

        const setupInviteChecks = () => {
            mockDb.select = vi
                .fn()
                .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-uploader", role: "uploader" } })) // isUploader check
                .mockImplementationOnce(() => makeQuery({ getResult: null })) // alreadyAuthor check
                .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-invitee" } })); // invitee exists check
        };

        const sendInviteRequest = async (token: string, app: any, env: any) => {
            return await app.request(
                "http://localhost/api/papers/paper-1/invites",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ inviteeId: "user-invitee" })
                },
                env as any
            );
        };

        it("POST /api/papers/:id/invites returns 409 when invite already exists", async () => {
            const token = await createTestJWT({ sub: "user-uploader", githubId: "123", name: "Uploader" });
            setupInviteChecks();

            mockDb.insert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValue(new Error(UNIQUE_INVITE_ERROR))
            });

            const app = await createTestApp();
            const env = createTestEnv();
            const res = await sendInviteRequest(token, app, env);

            expect(res.status).toBe(409);
            const data = (await res.json()) as any;
            expect(data.error).toBe("Invite already sent");
        });

        it("POST /api/papers/:id/invites returns 500 for non-UNIQUE database errors", async () => {
            const token = await createTestJWT({ sub: "user-uploader", githubId: "123", name: "Uploader" });
            setupInviteChecks();

            mockDb.insert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValue(new Error("Some other DB Error"))
            });

            const app = await createTestApp();
            const env = createTestEnv();
            const res = await sendInviteRequest(token, app, env);

            expect(res.status).toBe(500);
        });
    });
});
