with open("apps/api/src/routes/__tests__/feed.test.ts", "r") as f:
    content = f.read()

content = content.replace("await feedRoute.request(`/users/user1/collections/private-coll/atom.xml", "await (await createTestApp()).request(`/api/feed/users/user1/collections/private-coll/atom.xml")
content = content.replace("await feedRoute.request(`/orgs/org1/collections/private-coll/atom.xml", "await (await createTestApp()).request(`/api/feed/orgs/org1/collections/private-coll/atom.xml")

with open("apps/api/src/routes/__tests__/feed.test.ts", "w") as f:
    f.write(content)
