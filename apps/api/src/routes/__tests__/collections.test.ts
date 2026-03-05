import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv, makeQuery } from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

describe("collections routes", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        mockDb = {
            run: vi.fn(async () => undefined),
            select: vi.fn(() => makeQuery()),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
            delete: vi.fn(() => ({ where: vi.fn(async () => ({ meta: { changes: 1 } })) })),
            batch: vi.fn(async (queries) =>
                Promise.all(queries.map((q: any) => (q.all ? q.all() : q))),
            ),
        };
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
});
