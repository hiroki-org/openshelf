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
        expect(text).toContain("/api/papers/paper-1/files/file-1/stream");
        expect(text).toContain('length="1234"');
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

    it("GET /feed/orgs/:slug/atom.xml filters papers by tag", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "org-1",
                        slug: "lab",
                        name: "Lab",
                        description: null,
                        createdAt: "2026-01-01 00:00:00",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            id: "paper-1",
                            title: "Tagged Paper",
                            abstract: "AI abstract",
                            category: "report",
                            tags: JSON.stringify(["AI", "ML"]),
                            createdAt: "2026-01-03 00:00:00",
                            updatedAt: "2026-01-04 00:00:00",
                        },
                        {
                            id: "paper-2",
                            title: "Other Paper",
                            abstract: "NLP abstract",
                            category: "report",
                            tags: JSON.stringify(["NLP"]),
                            createdAt: "2026-01-05 00:00:00",
                            updatedAt: "2026-01-06 00:00:00",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            role: "uploader",
                            name: "Alice",
                            displayName: "Alice A.",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            id: "file-1",
                            filename: "paper.pdf",
                            sizeBytes: 1234,
                            mimeType: "application/pdf",
                        },
                    ],
                }),
            );

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/org/lab?tag=AI", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("Tagged Paper");
        expect(text).not.toContain("Other Paper");
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

    it("GET /feed/users/:id/atom.xml returns 404 when user is missing", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/missing/atom.xml", {}, env as any);

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "User not found" });
    });

    it("GET /feed/users/:id/atom.xml falls back to user name when displayName is null", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "user-1",
                    name: "Alice",
                    displayName: null,
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
            .mockImplementationOnce(() => makeQuery({ allResult: [] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-1/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Alice - OpenShelf</title>");
        expect(text).toContain("<author><name>Alice</name></author>");
    });

    it("GET /feed/users/:id/atom.xml falls back to OpenShelf when feed author is blank", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() => makeQuery({
                getResult: {
                    id: "user-1",
                    name: "   ",
                    displayName: null,
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
            .mockImplementationOnce(() => makeQuery({ allResult: [] }))
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-1/atom.xml", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("User Paper");
        expect(text).toContain("<author><name>OpenShelf</name></author>");
        expect(text).not.toMatch(/<author><name>\s+<\/name><\/author>/);
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

    it("GET /feed/users/:id/atom.xml filters papers by tag", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "user-1",
                        name: "Alice",
                        displayName: "Alice A.",
                        githubId: "alice",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            id: "paper-1",
                            title: "Tagged Paper",
                            abstract: "AI abstract",
                            category: "report",
                            tags: JSON.stringify(["AI", "ML"]),
                            createdAt: "2026-01-03 00:00:00",
                            updatedAt: "2026-01-04 00:00:00",
                        },
                        {
                            id: "paper-2",
                            title: "Other Paper",
                            abstract: "NLP abstract",
                            category: "report",
                            tags: JSON.stringify(["NLP"]),
                            createdAt: "2026-01-05 00:00:00",
                            updatedAt: "2026-01-06 00:00:00",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            role: "uploader",
                            name: "Alice",
                            displayName: "Alice A.",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            id: "file-1",
                            filename: "paper.pdf",
                            sizeBytes: 1234,
                            mimeType: "application/pdf",
                        },
                    ],
                }),
            );

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/feed/users/user-1/atom.xml?tag=AI", {}, env as any);

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("Tagged Paper");
        expect(text).not.toContain("Other Paper");
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

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 404 when collection is missing", async () => {
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
            .mockImplementationOnce(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/lab/collections/missing/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "Collection not found" });
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 404 when collection is private", async () => {
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
                    visibility: "private",
                    createdAt: "2026-01-01 00:00:00",
                    updatedAt: "2026-01-02 00:00:00",
                },
            }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/orgs/lab/collections/featured/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toEqual({ error: "Collection not found" });
    });

    it("GET /feed/users/:id/collections/:cSlug/atom.xml returns atom xml for public collection papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "user-1",
                        name: "Alice",
                        displayName: "Alice A.",
                        githubId: "alice",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "col-1",
                        ownerType: "user",
                        ownerId: "user-1",
                        orgSlug: null,
                        slug: "featured",
                        name: "Favorites",
                        description: null,
                        visibility: "public",
                        createdAt: "2026-01-01 00:00:00",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
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
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            role: "uploader",
                            name: "Alice",
                            displayName: "Alice A.",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/users/user-1/collections/featured/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Favorites - Alice A. - OpenShelf</title>");
        expect(text).toContain("Collection Paper");
    });

    it("GET /feed/org/:slug/collection/:collectionSlug returns atom xml for public collection papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "org-1",
                        slug: "lab",
                        name: "Lab",
                        description: null,
                        createdAt: "2026-01-01 00:00:00",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
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
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
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
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            role: "uploader",
                            name: "Alice",
                            displayName: "Alice A.",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/org/lab/collection/featured",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Featured - Lab - OpenShelf</title>");
        expect(text).toContain("Collection Paper");
    });

    it("GET /feed/user/:id/collection/:collectionSlug returns atom xml for public collection papers", async () => {
        mockDb.select = vi
            .fn()
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "user-1",
                        name: "Alice",
                        displayName: "Alice A.",
                        githubId: "alice",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    getResult: {
                        id: "col-1",
                        ownerType: "user",
                        ownerId: "user-1",
                        orgSlug: null,
                        slug: "featured",
                        name: "Favorites",
                        description: null,
                        visibility: "public",
                        createdAt: "2026-01-01 00:00:00",
                        updatedAt: "2026-01-02 00:00:00",
                    },
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
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
                }),
            )
            .mockImplementationOnce(() =>
                makeQuery({
                    allResult: [
                        {
                            paperId: "paper-1",
                            role: "uploader",
                            name: "Alice",
                            displayName: "Alice A.",
                        },
                    ],
                }),
            )
            .mockImplementationOnce(() => makeQuery({ allResult: [] }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/user/user-1/collection/featured",
            {},
            env as any,
        );

        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("<title>Favorites - Alice A. - OpenShelf</title>");
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

    it("GET /feed/users/:id/collections/:cSlug/atom.xml returns 400 for invalid slug", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/feed/users/user-1/collections/Invalid_Slug/atom.xml",
            {},
            env as any,
        );

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "invalid slug" });
    });
});
