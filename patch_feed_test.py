with open("apps/api/src/routes/__tests__/feed.test.ts", "r") as f:
    content = f.read()

new_tests = """
    it("GET /feed/users/:id/collections/:cSlug/atom.xml returns 404 for private or non-existent user collection", async () => {
        const res = await feedRoute.request(`/users/user1/collections/private-coll/atom.xml`, {
            method: "GET",
        }, mockEnv);
        expect(res.status).toBe(404);
    });

    it("GET /feed/orgs/:slug/collections/:cSlug/atom.xml returns 404 for private or non-existent org collection", async () => {
        const res = await feedRoute.request(`/orgs/org1/collections/private-coll/atom.xml`, {
            method: "GET",
        }, mockEnv);
        expect(res.status).toBe(404);
    });
"""

parts = content.rsplit("});", 1)
content = parts[0] + new_tests + "});" + parts[1]

with open("apps/api/src/routes/__tests__/feed.test.ts", "w") as f:
    f.write(content)
