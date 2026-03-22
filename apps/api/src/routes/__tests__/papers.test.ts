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
            insert: vi.fn((table) => ({ values: vi.fn((data) => ({ type: 'insert', table, data })) })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
            delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
            batch: vi.fn(async (queries) => Promise.all(queries.map((q: any) => q.all ? q.all() : q)))
        };
    });

    it("POST /api/papers logs cleanup failures on DB batch error", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.batch = vi.fn().mockRejectedValue(new Error("DB batch failed"));
        env.BUCKET.delete = vi.fn().mockRejectedValue(new Error("R2 delete rejected"));
        mockDb.delete = vi.fn(() => ({
            where: vi.fn().mockRejectedValue(new Error("DB delete rejected"))
        }));

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const form = new FormData();
            form.set("metadata", JSON.stringify({ title: "Fail Cleanup Paper", visibility: "private" }));
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

            // Validate the console.error call includes the specific expected errors
            expect(consoleErrorSpy).toHaveBeenCalled();
            const callArgs = consoleErrorSpy.mock.calls[0];
            expect(callArgs[0]).toBe("Cleanup failures for paperId:");
            expect(typeof callArgs[1]).toBe("string"); // paperId

            const failures = callArgs[2] as Error[];
            const r2Failures = failures.filter(f => f.message === "R2 delete rejected");
            const dbFailures = failures.filter(f => f.message === "DB delete rejected");

            expect(r2Failures.length).toBe(1);

            // mockDb.delete is called multiple times.
            // Ensure the failures reflect the number of mocked DB rejection attempts
            expect(dbFailures.length).toBe(mockDb.delete.mock.calls.length);

        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it("POST /api/papers logs outer cleanup failures if cleanup throws entirely", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.batch = vi.fn().mockRejectedValue(new Error("DB batch failed"));

        // mock Promise.allSettled to throw immediately when called for R2 deletion
        const promiseAllSettledSpy = vi.spyOn(Promise, 'allSettled').mockImplementationOnce(async () => {
             throw new Error("R2 Promise map failed");
        });

        // Make the DB delete promise array evaluation throw
        mockDb.delete = vi.fn(() => {
            throw new Error("DB delete call failed");
        });

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const form = new FormData();
            form.set("metadata", JSON.stringify({ title: "Fail Cleanup Paper Outer", visibility: "private" }));
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
            expect(consoleErrorSpy).toHaveBeenCalled();

            const allCalls = consoleErrorSpy.mock.calls;
            // Map the errors depending on if they were logged together or separately
            let foundR2 = false;
            let foundDB = false;

            for (const call of allCalls) {
                 for (const arg of call) {
                      if (Array.isArray(arg)) {
                          if (arg.some(e => e?.message === "R2 Promise map failed")) foundR2 = true;
                          if (arg.some(e => e?.message === "DB delete call failed")) foundDB = true;
                      } else if (arg instanceof Error) {
                          if (arg.message === "R2 Promise map failed") foundR2 = true;
                          if (arg.message === "DB delete call failed") foundDB = true;
                      }
                 }
            }

            expect(foundR2).toBe(true);
            expect(foundDB).toBe(true);
        } finally {
            consoleErrorSpy.mockRestore();
            promiseAllSettledSpy.mockRestore();
        }
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

    it("POST /api/papers creates paper with org_only visibility", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.select = vi.fn(() => makeQuery({ getResult: { orgId: "org-1" } }));

        const form = new FormData();
        form.set("metadata", JSON.stringify({ title: "Org Paper", visibility: "org_only", orgId: "org-1" }));
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
        expect(mockDb.batch).toHaveBeenCalledTimes(1);
        const batchArgs = mockDb.batch.mock.calls[0][0];
        expect(batchArgs).toHaveLength(4); // paper, author, org, files
        const orgInsert = batchArgs.find(
            (q: any) => q?.type === "insert" && q.data?.orgId === "org-1",
        );
        expect(orgInsert).toBeDefined();
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

        const mockPaperDetails = {
            id: "paper-1",
            title: "P1",
            visibility: "private",
            showViewCount: true,
            language: "ja",
            doi: "10.1234/example"
        };
        const mockPaperRole = {
            paperId: "paper-1",
            userId: "user-1",
            role: "uploader"
        };
        const mockPaperFiles = [
            { id: "file-1", filename: "paper.pdf" }
        ];
        const mockPaperContributors = [
            {
                userId: "user-1",
                role: "uploader",
                name: "Uploader",
                displayName: null,
                avatarUrl: null
            }
        ];
        const mockViewCountResult = { count: 4 };

        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: mockPaperDetails }))
            .mockImplementationOnce(() => makeQuery({ getResult: mockPaperRole }))
            .mockImplementationOnce(() => makeQuery({ allResult: mockPaperFiles }))
            .mockImplementationOnce(() => makeQuery({ allResult: mockPaperContributors }))
            .mockImplementationOnce(() => makeQuery({ getResult: mockViewCountResult }));

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

    it("PATCH /api/papers/:id rejects requests where tags is not an array or null", async () => {
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
                body: JSON.stringify({ tags: "not-an-array" }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const data = await res.json() as { error: string };
        expect(data.error).toBe("tags must be an array or null");
    });

    it("PATCH /api/papers/:id rejects tags where an item is not a string", async () => {
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
                body: JSON.stringify({ tags: [123] }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const data = await res.json() as { error: string };
        expect(data.error).toBe("each tag must be a string");
    });

    it("PATCH /api/papers/:id rejects overlong tags", async () => {
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
                body: JSON.stringify({ tags: ["a".repeat(65)] }),
            },
            env as any
        );

        expect(res.status).toBe(400);
        const data = await res.json() as { error: string };
        expect(data.error).toContain("each tag must be 64 chars or less");
    });

    it("PATCH /api/papers/:id handles valid tags update including empty strings mapping to null", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "paper-1", visibility: "private" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        mockDb.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }));

        const app = await createTestApp();
        const env = createTestEnv();

        // Null tags
        const res1 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tags: null }),
            },
            env as any
        );
        expect(res1.status).toBe(200);

        // Array with empty string
        const res2 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tags: ["  "] }),
            },
            env as any
        );
        expect(res2.status).toBe(200); // "  " is ignored, normalized tags is [], which maps to null. Updates tags to null.

        const res3 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tags: ["  ", "valid"] }),
            },
            env as any
        );
        expect(res3.status).toBe(200);
    });

    it("PATCH /api/papers/:id validates category", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { id: "paper-1", visibility: "private", paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        const app = await createTestApp();
        const env = createTestEnv();

        const res4 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ category: 123 }),
            },
            env as any
        );
        expect(res4.status).toBe(400);

        const res5 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ category: "invalid-category" }),
            },
            env as any
        );
        expect(res5.status).toBe(400);

        const res6 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ category: "thesis_master" }),
            },
            env as any
        );
        expect(res6.status).toBe(200);
    });

    it("PATCH /api/papers/:id validates DOI", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { id: "paper-1", visibility: "private", paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        const app = await createTestApp();
        const env = createTestEnv();

        const res7 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ doi: "a".repeat(1001) }),
            },
            env as any
        );
        expect(res7.status).toBe(400);

        const res8 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ doi: null }),
            },
            env as any
        );
        expect(res8.status).toBe(200);
    });

    it("PATCH /api/papers/:id validates venue and year", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { id: "paper-1", visibility: "private", paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        const app = await createTestApp();
        const env = createTestEnv();

        const res9 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ venue: "a".repeat(501) }),
            },
            env as any
        );
        expect(res9.status).toBe(400);

        const res10 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ year: "2024" }),
            },
            env as any
        );
        expect(res10.status).toBe(400);
    });

    it("PATCH /api/papers/:id validates venueType", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { id: "paper-1", visibility: "private", paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        const app = await createTestApp();
        const env = createTestEnv();

        const res11 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ venueType: "invalid" }),
            },
            env as any
        );
        expect(res11.status).toBe(400);

        const res12 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ venueType: null, category: null, tags: null }),
            },
            env as any
        );
        expect(res12.status).toBe(200);
    });

    it("PATCH /api/papers/:id rejects unknown fields", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: { id: "paper-1", visibility: "private", paperId: "paper-1", userId: "user-1", role: "uploader" } }));
        const app = await createTestApp();
        const env = createTestEnv();

        const res13 = await app.request(
            "http://localhost/api/papers/paper-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ unknownField: "val" }),
            },
            env as any
        );
        expect(res13.status).toBe(400);
        expect(await res13.json()).toEqual({ error: "No valid fields to update" });
    });

    it("POST /api/papers rejects invalid metadata", async () => {
        const app = await createTestApp();
        const token = await createTestJWT({ sub: "user-1" });
        const env = createTestEnv();

        const res1 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: new FormData(),
        }, env as any);
        expect(res1.status).toBe(400);
        expect(await res1.json()).toEqual({ error: "metadata field is required" });

        const form2 = new FormData();
        form2.append("metadata", "{");
        const res2 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form2,
        }, env as any);
        expect(res2.status).toBe(400);
        expect(await res2.json()).toEqual({ error: "Invalid metadata JSON" });

        const form3 = new FormData();
        form3.append("metadata", JSON.stringify({ title: "" }));
        const res3 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form3,
        }, env as any);
        expect(res3.status).toBe(400);
        expect((await res3.json() as any).error).toContain("title is required");

        // org_only without membership
        mockDb.select = vi.fn(() => makeQuery({ getResult: null })); // no membership
        const form4 = new FormData();
        form4.append("metadata", JSON.stringify({ title: "T", visibility: "org_only", orgId: "o1" }));
        const res4 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form4,
        }, env as any);
        expect(res4.status).toBe(403);

        // invalid file field
        const form5 = new FormData();
        form5.append("metadata", JSON.stringify({ title: "T" }));
        form5.append("files_0", "not-a-file");
        const res5 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form5,
        }, env as any);
        expect(res5.status).toBe(400);

        // no files
        const form6 = new FormData();
        form6.append("metadata", JSON.stringify({ title: "T" }));
        const res6 = await app.request("http://localhost/api/papers", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form6,
        }, env as any);
        expect(res6.status).toBe(400);
        expect(await res6.json()).toEqual({ error: "At least one file is required" });
    });

    it("authorizePaperAccess returns 401 for invalid token", async () => {
        const app = await createTestApp();
        const env = createTestEnv();
        mockDb.select = vi
            .fn()
            .mockImplementation(() => makeQuery({ getResult: { id: "p1", visibility: "private" } }));

        const res = await app.request("http://localhost/api/papers/p1", {
            headers: { Authorization: "Bearer invalid-token" }
        }, env as any);
        expect(res.status).toBe(401);
    });

    it("POST /api/papers/:id/view handles missing paper", async () => {
        const app = await createTestApp();
        const env = createTestEnv();
        mockDb.select = vi.fn().mockImplementation(() => makeQuery({ getResult: null }));

        const res = await app.request("http://localhost/api/papers/missing/view", {
            method: "POST",
            headers: { Origin: "http://localhost:3000" }
        }, env as any);
        expect(res.status).toBe(404);
    });

    it("GET /api/papers/:id handles org_only visibility", async () => {
        const app = await createTestApp();
        const token = await createTestJWT({ sub: "user-1" });
        const env = createTestEnv();

        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", visibility: "org_only" } })) // paper
            .mockImplementationOnce(() => makeQuery({ getResult: null })) // isAuthor
            .mockImplementationOnce(() => makeQuery({ getResult: null })); // isMemberOfPaperOrg

        const res = await app.request("http://localhost/api/papers/p1", {
            headers: { Authorization: `Bearer ${token}` }
        }, env as any);
        expect(res.status).toBe(403);
    });

    it("POST /api/papers/:id/view returns 201 when recording a new view", async () => {
        const values = vi.fn(async () => undefined);
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", visibility: "public" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));
        mockDb.insert = vi.fn(() => ({ values }));

        const res = await app.request("http://localhost/api/papers/p1/view", {
            method: "POST",
            headers: {
                Origin: "http://localhost:3000",
            }
        }, env as any);
        expect(res.status).toBe(201);
        expect(values).toHaveBeenCalledTimes(1);
        expect(await res.json()).toEqual({ counted: true });
    });

    it("POST /api/papers/:id/view returns counted: false if view already exists", async () => {
        const app = await createTestApp();
        const env = createTestEnv();
        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", visibility: "public" } })) // paper
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "v1" } })); // existing view

        const res = await app.request("http://localhost/api/papers/p1/view", {
            method: "POST",
            headers: { Origin: "http://localhost:3000" }
        }, env as any);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ counted: false });
    });

    it("POST /api/papers/:id/view returns counted: false on unique constraint error", async () => {
        const app = await createTestApp();
        const env = createTestEnv();
        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", visibility: "public" } })) // paper
            .mockImplementationOnce(() => makeQuery({ getResult: null })); // no existing view
        mockDb.insert = vi.fn(() => ({
            values: vi.fn(async () => { throw new Error("UNIQUE constraint failed"); })
        }));

        const res = await app.request("http://localhost/api/papers/p1/view", {
            method: "POST",
            headers: { Origin: "http://localhost:3000" }
        }, env as any);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ counted: false });
    });

    it("GET /api/papers/:id/invites lists them", async () => {
        const app = await createTestApp();
        const token = await createTestJWT({ sub: "user-1" });
        const env = createTestEnv();

        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", userId: "user-1", role: "uploader" } })) // isUploader check for GET
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "inv-1", inviteeId: "user-2", paperId: "p1" }] })) // invites
            .mockImplementationOnce(() => makeQuery({ allResult: [{ id: "user-2", name: "Bob" }] })); // invitees

        const res = await app.request("http://localhost/api/papers/p1/invites", {
            headers: { Authorization: `Bearer ${token}` }
        }, env as any);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.invites).toHaveLength(1);
        expect(body.invites[0].inviteeName).toBe("Bob");
    });

    it("POST /api/papers/:id/invites rejects inviting self", async () => {
        const app = await createTestApp();
        const token = await createTestJWT({ sub: "u1" });
        const env = createTestEnv();

        mockDb.select = vi.fn().mockImplementationOnce(() => makeQuery({ getResult: { role: "uploader" } }));

        const res = await app.request("http://localhost/api/papers/p1/invites", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: "http://localhost:3000" },
            body: JSON.stringify({ inviteeId: "u1" })
        }, env as any);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Cannot invite yourself" });
    });

    it("POST /api/papers/:id/invites handles resolve by email and existing author check", async () => {
        const app = await createTestApp();
        const token = await createTestJWT({ sub: "u1" });
        const env = createTestEnv();

        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { role: "uploader" } })) // isUploader
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "u2" } })) // resolve email
            .mockImplementationOnce(() => makeQuery({ getResult: { paperId: "p1", userId: "u2" } })); // already author

        const res = await app.request("http://localhost/api/papers/p1/invites", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: "http://localhost:3000" },
            body: JSON.stringify({ inviteeEmail: "bob@example.com" })
        }, env as any);
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "User is already an author" });
    });

    it("GET /api/papers/:id/files/:fileId/preview returns 404 for missing file", async () => {
        const app = await createTestApp();
        const env = createTestEnv();
        mockDb.select = vi.fn()
            .mockImplementationOnce(() => makeQuery({ getResult: { id: "p1", visibility: "public" } }))
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const res = await app.request("http://localhost/api/papers/p1/files/f1/preview", {}, env as any);
        expect(res.status).toBe(404);
    });
});
