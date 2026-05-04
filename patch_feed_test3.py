with open("apps/api/src/routes/__tests__/feed.test.ts", "r") as f:
    content = f.read()

content = content.replace(", mockEnv);", ", createTestEnv() as any);")
content = content.replace("await (await createTestApp()).request(`/api/feed/users", "await (await createTestApp()).request(`http://localhost/feed/users")
content = content.replace("await (await createTestApp()).request(`/api/feed/orgs", "await (await createTestApp()).request(`http://localhost/feed/orgs")

with open("apps/api/src/routes/__tests__/feed.test.ts", "w") as f:
    f.write(content)
