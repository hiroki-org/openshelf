import sys

file_path = 'apps/api/src/routes/__tests__/collections.test.ts'
content = open(file_path).read()

# Conflict 1
c1 = """<<<<<<< HEAD
    it("POST /api/collections returns 400 for invalid visibility (string not in VALID_VISIBILITY)", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}` },
        body: JSON.stringify({ name: "C1", slug: "col-1", owner_type: "user", visibility: "invalid_string" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

it("POST /api/collections returns 400 for invalid visibility", async () => {
=======
  it("POST /api/collections returns 400 for invalid visibility", async () => {
>>>>>>> origin/staging"""

r1 = """  it("POST /api/collections returns 400 for invalid visibility (string not in VALID_VISIBILITY)", async () => {
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}` },
        body: JSON.stringify({ name: "C1", slug: "col-1", owner_type: "user", visibility: "invalid_string" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

  it("POST /api/collections returns 400 for invalid visibility", async () => {"""
content = content.replace(c1, r1)

# Conflict 2
c2 = """<<<<<<< HEAD
  it("PATCH /api/collections/:id returns 400 when visibility is an invalid string", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ visibility: "invalid_string_vis" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

  it("PATCH /api/collections/:id returns 400 when visibility is not a string", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ visibility: 123 }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });

=======
>>>>>>> origin/staging"""

r2 = """  it("PATCH /api/collections/:id returns 400 when visibility is an invalid string", async () => {
    queueSelectResponses([
      { getResult: { id: "c1", ownerType: "user", ownerId: "user-1" } },
    ]);
    const app = await createTestApp();
    const env = createTestEnv();
    const res = await app.request(
      "http://localhost/api/collections/c1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await createTestJWT({ sub: "user-1" })}`,
        },
        body: JSON.stringify({ visibility: "invalid_string_vis" }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid visibility" });
  });"""

content = content.replace(c2, r2)

c3 = """<<<<<<< HEAD
=======

  it("POST /api/collections/:id/papers propagates unexpected db errors", async () => {
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
      values: vi.fn().mockRejectedValue(new Error("Unexpected database error")),
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

    expect(res.status).toBe(500);
  });
>>>>>>> origin/staging"""

r3 = """  it("POST /api/collections/:id/papers propagates unexpected db errors", async () => {
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
      values: vi.fn().mockRejectedValue(new Error("Unexpected database error")),
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

    expect(res.status).toBe(500);
  });"""

content = content.replace(c3, r3)

open(file_path, 'w').write(content)
print("Conflict resolved.")
