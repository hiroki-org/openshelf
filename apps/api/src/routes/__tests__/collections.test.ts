import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    createMockDb as createSharedMockDb,
    createTestEnv,
    createTestJWT,
    makeQuery,
    queueSelectResponses as queueSharedSelectResponses,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

function createMockDb() {
    return createSharedMockDb();
}

function queueSelectResponses(
    responses: Array<{ getResult?: unknown; allResult?: unknown[] }>,
) {
    queueSharedSelectResponses(mockDb, responses);
}

describe("collections routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = createMockDb();
    });

    it("POST /api/collections requires auth", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:3000",
                },
                body: JSON.stringify({ owner_type: "user", name: "My Collection", slug: "my-collection" }),
            },
            env as any,
        );

        expect(res.status).toBe(401);
    });

    it("GET /api/collections/:id returns 404 when not found", async () => {
        mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/api/collections/not-found", {}, env as any);

        expect(res.status).toBe(404);
    });

    it("GET /api/users/:id/collections returns list", async () => {
        mockDb.select = vi.fn(() =>
            makeQuery({
                allResult: [
                    {
                        id: "col-1",
                        ownerType: "user",
                        ownerId: "user-1",
                        slug: "favorites",
                        name: "Favorites",
                        description: null,
                        visibility: "public",
                    },
                ],
            }),
        );

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/api/users/user-1/collections", {}, env as any);

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.collections).toHaveLength(1);
        expect(body.collections[0].slug).toBe("favorites");
    });

    it("POST /api/collections creates a user collection", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const createdCollection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            slug: "favorites",
            name: "Favorites",
            description: "Picked papers",
            visibility: "private",
        };
        queueSelectResponses([{ getResult: createdCollection }]);

        const insertValues = vi.fn(async () => undefined);
        mockDb.insert = vi.fn(() => ({ values: insertValues }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    owner_type: "user",
                    name: "Favorites",
                    slug: "favorites",
                    description: " Picked papers ",
                }),
            },
            env as any,
        );

        expect(res.status).toBe(201);
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerType: "user",
                ownerId: "user-1",
                slug: "favorites",
                name: "Favorites",
                description: "Picked papers",
                visibility: "private",
            }),
        );
    });

    it("POST /api/collections returns 403 when requester cannot manage org collections", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            { getResult: { id: "org-1", slug: "lab" } },
            { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    owner_type: "org",
                    org_slug: "lab",
                    name: "Lab picks",
                    slug: "lab-picks",
                    visibility: "org_only",
                }),
            },
            env as any,
        );

        expect(res.status).toBe(403);
        expect((await res.json()) as any).toEqual({
            error: "Forbidden: admin access required",
        });
    });

    it("GET /api/collections/:id hides private collections from anonymous users", async () => {
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/api/collections/col-1", {}, env as any);

        expect(res.status).toBe(404);
    });

    it("GET /api/collections/:id returns a private collection to its owner", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(((await res.json()) as any).collection.id).toBe("col-1");
    });

    it("PATCH /api/collections/:id updates collection details for the owner", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const existingCollection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            name: "Old",
            slug: "old",
            description: null,
            visibility: "private",
        };
        const updatedCollection = {
            ...existingCollection,
            name: "Renamed",
            slug: "renamed",
            visibility: "public",
        };
        queueSelectResponses([
            { getResult: existingCollection },
            { getResult: updatedCollection },
        ]);

        const setValues = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
        mockDb.update = vi.fn(() => ({ set: setValues }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: " Renamed ",
                    slug: "RENAMED",
                    visibility: "public",
                }),
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(setValues).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Renamed",
                slug: "renamed",
                visibility: "public",
            }),
        );
        expect(((await res.json()) as any).collection.slug).toBe("renamed");
    });

    it("PATCH /api/collections/:id rejects requests without updatable fields", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
            env as any,
        );

        expect(res.status).toBe(400);
        expect(((await res.json()) as any).error).toBe("No fields to update");
    });

    it("DELETE /api/collections/:id deletes a collection for the owner", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        const deleteWhere = vi.fn(async () => ({ meta: { changes: 1 } }));
        mockDb.delete = vi.fn(() => ({ where: deleteWhere }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1",
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
        expect(deleteWhere).toHaveBeenCalled();
    });

    it("GET /api/orgs/:slug/collections returns admin-visible collections", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            { getResult: { id: "org-1", slug: "lab" } },
            {
                allResult: [
                    { id: "c1", visibility: "public", ownerType: "org", ownerId: "org-1" },
                    { id: "c2", visibility: "org_only", ownerType: "org", ownerId: "org-1" },
                    { id: "c3", visibility: "private", ownerType: "org", ownerId: "org-1" },
                ],
            },
            { getResult: { orgId: "org-1", userId: "user-1", role: "admin" } },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/orgs/lab/collections",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(((await res.json()) as any).collections).toHaveLength(3);
    });

    it("GET /api/orgs/:slug/collections hides private org collections from non-admin members", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            { getResult: { id: "org-1", slug: "lab" } },
            {
                allResult: [
                    { id: "c1", visibility: "public", ownerType: "org", ownerId: "org-1" },
                    { id: "c2", visibility: "org_only", ownerType: "org", ownerId: "org-1" },
                    { id: "c3", visibility: "private", ownerType: "org", ownerId: "org-1" },
                ],
            },
            { getResult: { orgId: "org-1", userId: "user-1", role: "member" } },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/orgs/lab/collections",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(((await res.json()) as any).collections.map((row: any) => row.id)).toEqual([
            "c1",
            "c2",
        ]);
    });

    it("POST /api/collections/:id/papers adds a visible paper with the next sort order", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const collection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            visibility: "private",
        };
        queueSelectResponses([
            { getResult: collection },
            { getResult: { id: "paper-1", visibility: "private" } },
            { getResult: { paperId: "paper-1" } },
            { getResult: { maxOrder: 2 } },
        ]);

        const insertValues = vi.fn(async () => undefined);
        mockDb.insert = vi.fn(() => ({ values: insertValues }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_id: "paper-1" }),
            },
            env as any,
        );

        expect(res.status).toBe(201);
        expect(insertValues).toHaveBeenCalledWith({
            collectionId: "col-1",
            paperId: "paper-1",
            sortOrder: 3,
        });
    });



    it("POST /api/collections/:id/papers adds a paper the manager can view via org membership", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const collection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            visibility: "private",
        };
        queueSelectResponses([
            { getResult: collection }, // Collection query
            { getResult: { id: "paper-1", visibility: "org_only" } }, // Paper query
            { getResult: null }, // isPaperAuthor returns false
            { getResult: { id: "user-1" } }, // isMemberOfPaperOrg returns true
            { getResult: { maxOrder: 2 } }, // maxOrder query
        ]);

        const insertValues = vi.fn(async () => undefined);
        mockDb.insert = vi.fn(() => ({ values: insertValues }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_id: "paper-1" }),
            },
            env as any,
        );

        expect(res.status).toBe(201);
        expect(insertValues).toHaveBeenCalledWith({
            collectionId: "col-1",
            paperId: "paper-1",
            sortOrder: 3,
        });
    });

    it("POST /api/collections/:id/papers adds a public paper without specific membership", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const collection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            visibility: "private",
        };
        queueSelectResponses([
            { getResult: collection }, // Collection query
            { getResult: { id: "paper-1", visibility: "public" } }, // Paper query
            { getResult: { maxOrder: 2 } }, // maxOrder query
        ]);

        const insertValues = vi.fn(async () => undefined);
        mockDb.insert = vi.fn(() => ({ values: insertValues }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_id: "paper-1" }),
            },
            env as any,
        );

        expect(res.status).toBe(201);
        expect(insertValues).toHaveBeenCalledWith({
            collectionId: "col-1",
            paperId: "paper-1",
            sortOrder: 3,
        });
    });

    it("POST /api/collections/:id/papers rejects papers the manager cannot view", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
            { getResult: { id: "paper-1", visibility: "private" } },
            { getResult: null },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_id: "paper-1" }),
            },
            env as any,
        );

        expect(res.status).toBe(404);
        expect(((await res.json()) as any).error).toBe("Paper not found");
    });

    it("PATCH /api/collections/:id/papers rejects duplicate paper IDs", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
            {
                allResult: [{ paperId: "paper-1" }, { paperId: "paper-2" }],
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_ids: ["paper-1", "paper-1"] }),
            },
            env as any,
        );

        expect(res.status).toBe(400);
        expect(((await res.json()) as any).error).toBe(
            "paper_ids must not contain duplicates",
        );
    });

    it("PATCH /api/collections/:id/papers requires every existing paper to be included", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
            {
                allResult: [{ paperId: "paper-1" }, { paperId: "paper-2" }],
            },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_ids: ["paper-1"] }),
            },
            env as any,
        );

        expect(res.status).toBe(400);
        expect(((await res.json()) as any).error).toBe(
            "paper_ids must include all papers in collection",
        );
    });

    it("DELETE /api/collections/:id/papers/:paperId returns 404 when the paper is not in the collection", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        mockDb.delete = vi.fn(() => ({
            where: vi.fn(async () => ({ meta: { changes: 0 } })),
        }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers/paper-1",
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(404);
        expect(((await res.json()) as any).error).toBe("Paper not in collection");
    });

    it("GET /api/collections/:id/papers filters restricted papers by authorship and org access", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "org",
                    ownerId: "org-1",
                    visibility: "public",
                },
            },
            {
                allResult: [
                    { id: "paper-public", title: "Public", visibility: "public", sortOrder: 0 },
                    { id: "paper-authored", title: "Mine", visibility: "private", sortOrder: 1 },
                    { id: "paper-org", title: "Org only", visibility: "org_only", sortOrder: 2 },
                    { id: "paper-hidden", title: "Hidden", visibility: "private", sortOrder: 3 },
                ],
            },
            { allResult: [{ paperId: "paper-authored" }] },
            { allResult: [{ paperId: "paper-org" }] },
        ]);

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                headers: { Authorization: `Bearer ${token}` },
            },
            env as any,
        );

        expect(res.status).toBe(200);
        expect(((await res.json()) as any).papers.map((paper: any) => paper.id)).toEqual([
            "paper-public",
            "paper-authored",
            "paper-org",
        ]);
    });

    it("POST /api/collections/:id/papers returns 409 when paper is already in collection", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        const collection = {
            id: "col-1",
            ownerType: "user",
            ownerId: "user-1",
            visibility: "private",
        };
        queueSelectResponses([
            { getResult: collection }, // Collection query
            { getResult: { id: "paper-1", visibility: "public" } }, // Paper query
            { getResult: { maxOrder: 2 } }, // maxOrder query
        ]);

        mockDb.insert = vi.fn(() => ({
            values: vi.fn().mockRejectedValue(
                new Error("UNIQUE constraint failed: collection_papers.collection_id, collection_papers.paper_id"),
            ),
        }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1/papers",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paper_id: "paper-1" }),
            },
            env as any,
        );

        expect(res.status).toBe(409);
        expect(((await res.json()) as any).error).toBe("Paper already added");
    });
});
