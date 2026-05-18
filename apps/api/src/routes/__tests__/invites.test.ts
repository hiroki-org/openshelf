import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestApp,
  createTestEnv,
  createTestJWT,
  makeQuery,
} from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

describe("invites routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = {
      run: vi.fn(async () => undefined),
      select: vi.fn(() => makeQuery()),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
      batch: vi.fn(async () => undefined),
    };
  });

  it("POST /api/papers/:id/invites sends coauthor invite", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({
          getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" },
        }),
      )
      .mockImplementationOnce(() => makeQuery({ getResult: null }))
      .mockImplementationOnce(() => makeQuery({ getResult: { id: "user-2" } }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/papers/paper-1/invites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteeId: "user-2" }),
      },
      env as any,
    );

    expect(res.status).toBe(201);
  });

  it("GET /api/invites/received returns invites", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        allResult: [
          {
            id: "inv-1",
            paperId: "paper-1",
            paperTitle: "Paper",
            status: "pending",
          },
        ],
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/received",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      invites: [
        {
          id: "inv-1",
          paperId: "paper-1",
          paperTitle: "Paper",
          status: "pending",
        },
      ],
    });
  });

  it("PUT /api/invites/:id accepts invite", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "pending",
        },
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "accept" }),
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, status: "accepted" });
    expect(mockDb.batch).toHaveBeenCalledTimes(1);
  });

  it("PATCH /api/invites/:id declines invite", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "pending",
        },
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "decline" }),
      },
      env as any,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, status: "declined" });
  });

  it("PUT /api/invites/:id returns 400 for invalid JSON", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{ invalid }",
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("POST /api/papers/:id/invites returns 400 when inviting self", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({
          getResult: { paperId: "paper-1", userId: "user-1", role: "uploader" },
        }),
      );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/papers/paper-1/invites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteeId: "user-1" }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
  });

  it("PUT /api/invites/:id returns 400 for invalid action", async () => {
    const token = await createTestJWT({
      sub: "user-1",
      githubId: "123",
      name: "Uploader",
    });
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "invalid_action" }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "action must be accept or decline",
    });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("PUT /api/invites/:id returns 404 when invite not found", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() => makeQuery({ getResult: null }));

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "accept" }),
      },
      env as any,
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Invite not found" });
  });

  it("PUT /api/invites/:id returns 500 when foreign key setup fails", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.run = vi.fn().mockRejectedValue(new Error("FK setup failed"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const app = await createTestApp();
    const env = createTestEnv();

    try {
      const res = await app.request(
        "http://localhost/api/invites/inv-1",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "accept" }),
        },
        env as any,
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Failed to respond to invite",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to respond to invite",
        expect.any(Error),
      );
      expect(mockDb.select).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PUT /api/invites/:id returns 500 when invite lookup fails", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() => {
      throw new Error("DB select error");
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const app = await createTestApp();
    const env = createTestEnv();

    try {
      const res = await app.request(
        "http://localhost/api/invites/inv-1",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "accept" }),
        },
        env as any,
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Failed to respond to invite",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to respond to invite",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PUT /api/invites/:id returns 403 when user is not invitee", async () => {
    const token = await createTestJWT({
      sub: "user-3",
      githubId: "789",
      name: "OtherUser",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "pending",
        },
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "accept" }),
      },
      env as any,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("PUT /api/invites/:id returns 400 when invite is already responded to", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "accepted",
        },
      }),
    );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/invites/inv-1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "accept" }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invite already responded",
    });
  });

  it("PUT /api/invites/:id propagates db.batch error on accept", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "pending",
        },
      }),
    );
    mockDb.batch = vi.fn().mockRejectedValue(new Error("DB batch error"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const app = await createTestApp();
    const env = createTestEnv();

    try {
      const res = await app.request(
        "http://localhost/api/invites/inv-1",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "accept" }),
        },
        env as any,
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Failed to respond to invite",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to respond to invite",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("PUT /api/invites/:id propagates db.update error on decline", async () => {
    const token = await createTestJWT({
      sub: "user-2",
      githubId: "456",
      name: "Invitee",
    });
    mockDb.select = vi.fn(() =>
      makeQuery({
        getResult: {
          id: "inv-1",
          inviteeId: "user-2",
          paperId: "paper-1",
          status: "pending",
        },
      }),
    );
    mockDb.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockRejectedValue(new Error("DB update error")),
      })),
    }));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const app = await createTestApp();
    const env = createTestEnv();

    try {
      const res = await app.request(
        "http://localhost/api/invites/inv-1",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "decline" }),
        },
        env as any,
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Failed to respond to invite",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to respond to invite",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
