import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createMockDb as createSharedMockDb,
    createTestApp,
    createTestEnv,
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

describe("badge routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = createMockDb();
    });

    it("GET /badge/:paperId returns SVG badge for public papers", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-1",
                    title: "Graph Neural Search in Mixed Languages",
                    year: 2026,
                    visibility: "public",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/badge/paper-1",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("image/svg+xml");
        expect(res.headers.get("cache-control")).toBe(
            "public, max-age=86400, stale-while-revalidate=3600",
        );
        expect(res.headers.get("etag")).toBeTruthy();
        const body = await res.text();
        expect(body).toContain("<svg");
        expect(body).toContain("📄 OpenShelf");
        expect(body).toContain("(2026)");
    });

    it("GET /badge/:paperId?style=compact returns compact message", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-1",
                    title: "Any title",
                    year: null,
                    visibility: "public",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/badge/paper-1?style=compact&label=Repo&color=ff69b4",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("📄 Repo");
        expect(body).toContain(">Paper<");
        expect(body).toContain("#ff69b4");
    });

    it("GET /badge/:paperId returns escaped SVG for XSS-like title", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-1",
                    title: "<script>alert(1)</script> & bad",
                    year: 2025,
                    visibility: "public",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();
        const res = await app.request(
            "http://localhost/badge/paper-1",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).not.toContain("<script>");
        expect(body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(body).toContain("&amp; bad");
    });

    it("GET /badge/:paperId returns 404 not-found SVG for private/not found papers", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-2",
                    title: "Private",
                    year: 2026,
                    visibility: "private",
                },
            },
            {
                getResult: null,
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const privateRes = await app.request(
            "http://localhost/badge/paper-2",
            {},
            env as any,
        );
        expect(privateRes.status).toBe(404);
        expect(privateRes.headers.get("content-type")).toContain("image/svg+xml");
        expect(await privateRes.text()).toContain("not found");

        const missingRes = await app.request(
            "http://localhost/badge/missing-id",
            {},
            env as any,
        );
        expect(missingRes.status).toBe(404);
        expect(await missingRes.text()).toContain("not found");
    });

    it("GET /badge/api/:paperId returns shields endpoint JSON", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-1",
                    title: "OpenShelf Dynamic Badge",
                    year: 2024,
                    visibility: "public",
                },
            },
            {
                getResult: {
                    id: "paper-private",
                    title: "Private",
                    year: null,
                    visibility: "private",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const okRes = await app.request(
            "http://localhost/badge/api/paper-1?label=OpenShelf&color=blue",
            {},
            env as any,
        );
        expect(okRes.status).toBe(200);
        await expect(okRes.json()).resolves.toMatchObject({
            schemaVersion: 1,
            label: "📄 OpenShelf",
            color: "blue",
        });

        const privateRes = await app.request(
            "http://localhost/badge/api/paper-private",
            {},
            env as any,
        );
        expect(privateRes.status).toBe(404);
        await expect(privateRes.json()).resolves.toMatchObject({
            schemaVersion: 1,
            label: "📄 OpenShelf",
            message: "not found",
            color: "9f9f9f",
        });
    });

    it("returns 304 when If-None-Match matches ETag", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "paper-1",
                    title: "ETag paper",
                    year: 2023,
                    visibility: "public",
                },
            },
            {
                getResult: {
                    id: "paper-1",
                    title: "ETag paper",
                    year: 2023,
                    visibility: "public",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();
        const first = await app.request("http://localhost/badge/paper-1", {}, env as any);
        const etag = first.headers.get("etag");
        expect(etag).toBeTruthy();

        const second = await app.request(
            "http://localhost/badge/paper-1",
            { headers: { "If-None-Match": etag! } },
            env as any,
        );
        expect(second.status).toBe(304);
        expect(second.headers.get("etag")).toBe(etag);
        expect(await second.text()).toBe("");
    });
});
