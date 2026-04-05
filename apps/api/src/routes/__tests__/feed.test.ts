import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv, makeQuery } from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

describe("feed routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            select: vi.fn(() => makeQuery()),
        };
    });

    it("GET /feed/orgs/:slug/atom.xml returns atom xml for public org papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        id: "paper-1",
                        title: "Public Paper",
                        abstract: "Abstract text",
                        category: "report",
                        createdAt: "2026-01-03 00:00:00",
                        updatedAt: "2026-01-04 00:00:00",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        paperId: "paper-1",
                        role: "uploader",
                        name: "Alice",
                        displayName: "Alice A.",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        paperId: "paper-1",
                        id: "file-1",
                        filename: "paper.pdf",
                        sizeBytes: 1234,
                        mimeType: "application/pdf",
                    },
                ],
            }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/lab/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("application/atom+xml");
        const text = await res.text();
        expect(text).toContain("<feed xmlns=\"http://www.w3.org/2005/Atom\">");
        expect(text).toContain("<title>Lab - OpenShelf</title>");
        expect(text).toContain("<entry>");
        expect(text).toContain("Public Paper");
        expect(text).toContain("rel=\"enclosure\"");
    });

    it("GET /feed/orgs/:slug/atom.xml returns 404 when org is missing", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/missing/atom.xml", {}, env as any);

        expect(res.status).toBe(404);
    });

    it("GET /feed/orgs/:slug/atom.xml returns valid xml for empty org feeds", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/lab/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<feed xmlns=\"http://www.w3.org/2005/Atom\">");
        expect(text).toContain("<title>Lab - OpenShelf</title>");
    });

    it("GET /feed/orgs/:slug/atom.xml returns 400 for invalid slug", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/Invalid_Slug/atom.xml", {}, env as any);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "invalid slug" });
    });

    it("GET /feed/users/:id/atom.xml returns atom xml for public user papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "user-1",
                    name: "Alice",
                    displayName: "Alice A.",
                    githubId: "alice",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        id: "paper-1",
                        title: "User Paper",
                        abstract: null,
                        category: null,
                        createdAt: "2026-01-03 00:00:00",
                        updatedAt: "2026-01-04 00:00:00",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        paperId: "paper-1",
                        role: "uploader",
                        name: "Alice",
                        displayName: "Alice A.",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-1/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Alice A. - OpenShelf</title>");
        expect(text).toContain("User Paper");
    });

    it("GET /feed/users/:id/atom.xml de-duplicates repeated paper rows", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "user-1",
                    name: "Alice",
                    displayName: "Alice A.",
                    githubId: "alice",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        id: "paper-1",
                        title: "User Paper",
                        abstract: null,
                        category: null,
                        createdAt: "2026-01-03 00:00:00",
                        updatedAt: "2026-01-04 00:00:00",
                    },
                    {
                        id: "paper-1",
                        title: "User Paper",
                        abstract: null,
                        category: null,
                        createdAt: "2026-01-03 00:00:00",
                        updatedAt: "2026-01-04 00:00:00",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        paperId: "paper-1",
                        role: "uploader",
                        name: "Alice",
                        displayName: "Alice A.",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-1/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text.match(/<entry>/g)).toHaveLength(1);
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns atom xml for public collection papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "col-1",
                    ownerType: "org",
                    ownerId: "org-1",
                    orgSlug: "lab",
                    slug: "featured",
                    name: "Featured",
                    description: null,
                    visibility: "public",
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        id: "paper-1",
                        title: "Collection Paper",
                        abstract: "Collection abstract",
                        category: "report",
                        createdAt: "2026-01-03 00:00:00",
                        updatedAt: "2026-01-04 00:00:00",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        paperId: "paper-1",
                        role: "uploader",
                        name: "Alice",
                        displayName: "Alice A.",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/lab/collections/featured/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Featured - Lab - OpenShelf</title>");
        expect(text).toContain("Collection Paper");
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 400 for invalid slug", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/lab/collections/Invalid_Slug/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "invalid slug" });
    });

    it("GET /feed/users/:id/atom.xml returns 404 when user is missing", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/nonexistent/atom.xml", {}, env as any);

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "User not found" });
    });

    it("GET /feed/users/:id/atom.xml uses name fallback when displayName is null", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "user-2",
                    name: "Bob",
                    displayName: null,
                    githubId: "bob",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-2/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Bob - OpenShelf</title>");
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 404 when org is missing", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/missing-org/collections/some-col/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "Org not found" });
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 404 for private collection", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "col-1",
                    ownerType: "org",
                    ownerId: "org-1",
                    orgSlug: "lab",
                    slug: "secret",
                    name: "Secret",
                    description: null,
                    visibility: "private",
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/lab/collections/secret/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "Collection not found" });
    });

    it("GET /feed/orgs/:slug/atom.xml sets Cache-Control header", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/lab/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toContain("public");
        expect(res.headers.get("cache-control")).toContain("max-age=3600");
    });

    it("GET /feed/orgs/:slug/atom.xml uses updated timestamp of most recently updated paper", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "org-1",
                    slug: "lab",
                    name: "Lab",
                    description: null,
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-01 00:00:00",
                },
            }))
            .mockImplementationOnce(() => makeQuery({
                allResult: [
                    {
                        id: "paper-old",
                        title: "Old Paper",
                        abstract: null,
                        category: null,
                        createdAt: "2026-01-01 00:00:00",
                        updatedAt: "2026-01-01 00:00:00",
                    },
                    {
                        id: "paper-new",
                        title: "New Paper",
                        abstract: null,
                        category: null,
                        createdAt: "2026-01-05 00:00:00",
                        updatedAt: "2026-01-10 00:00:00",
                    },
                ],
            }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/lab/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        // Feed updated should reflect the newest paper's updatedAt
        expect(text).toContain("2026-01-10T00:00:00.000Z");
    });

    it("GET /feed/orgs/:slug/atom.xml returns 400 for single-char invalid slug with underscore", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/orgs/_/atom.xml", {}, env as any);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "invalid slug" });
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 400 when org slug is invalid", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/BAD_ORG/collections/valid-col/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "invalid slug" });
    });
});