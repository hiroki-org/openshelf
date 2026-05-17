import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, createTestEnv, makeQuery } from "../../test/helpers";

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

describe("papers preview routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = {
      run: vi.fn(async () => undefined),
      select: vi.fn(() => makeQuery()),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      batch: vi.fn(async (queries) =>
        Promise.all(queries.map((q: any) => (q.all ? q.all() : q))),
      ),
    };
  });

  it("GET /api/papers/:id/files/:fileId/preview returns signed URL for public paper without auth", async () => {
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
      )
      .mockImplementationOnce(() =>
        makeQuery({
          getResult: {
            id: "file-1",
            paperId: "paper-1",
            r2Key: "papers/paper-1/paper/sample.pdf",
            mimeType: "application/pdf",
            filename: "sample.pdf",
          },
        }),
      );

    const app = await createTestApp();
    const env = createTestEnv({
      BUCKET: {
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        get: vi.fn(async () => null),
        createSignedUrl: vi.fn(
          async () => "https://signed.example/paper.pdf?sig=test",
        ),
      } as any,
    });

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/file-1/preview",
      {},
      env as any,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toContain("https://signed.example");
    expect(body.mimeType).toBe("application/pdf");
    expect(body.filename).toBe("sample.pdf");
  });

  it("GET /api/papers/:id/files/:fileId/preview returns 401 for private paper without auth", async () => {
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({ getResult: { id: "paper-1", visibility: "private" } }),
      );

    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/file-1/preview",
      {},
      env as any,
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/papers/:id/files/batch-preview returns multiple signed URLs", async () => {
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
      )
      .mockImplementationOnce(() =>
        makeQuery({
          allResult: [
            {
              id: "file-1",
              mimeType: "image/png",
              filename: "1.png",
              r2Key: "k1",
            },
            {
              id: "file-2",
              mimeType: "image/jpeg",
              filename: "2.jpg",
              r2Key: "k2",
            },
          ],
        }),
      );

    const app = await createTestApp();
    const env = createTestEnv({
      BUCKET: {
        createSignedUrl: vi.fn(async (key) => `https://signed.example/${key}`),
      } as any,
    });

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/batch-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      },
      env as any,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.previews["file-1"]).toEqual({
      url: "https://signed.example/k1",
      mimeType: "image/png",
      filename: "1.png",
    });
    expect(body.previews["file-2"]).toEqual({
      url: "https://signed.example/k2",
      mimeType: "image/jpeg",
      filename: "2.jpg",
    });
  });

  it("POST /api/papers/:id/files/batch-preview handles empty fileIds array", async () => {
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/batch-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ fileIds: [] }),
      },
      env as any,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.previews).toEqual({});
  });

  it("POST /api/papers/:id/files/batch-preview enforces maximum fileIds length", async () => {
    const app = await createTestApp();
    const env = createTestEnv();

    const fileIds = Array.from({ length: 51 }, (_, i) => `file-${i}`);

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/batch-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ fileIds }),
      },
      env as any,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Maximum 50 file IDs allowed");
  });

  it("POST /api/papers/:id/files/batch-preview handles malformed JSON", async () => {
    const app = await createTestApp();
    const env = createTestEnv();

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/batch-preview",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: "{", // Invalid JSON
      },
      env as any,
    );

    expect(res.status).toBe(400);
  });

  it("GET /api/papers/:id/files/:fileId/preview falls back to stream URL when signed URL generation fails", async () => {
    mockDb.select = vi
      .fn()
      .mockImplementationOnce(() =>
        makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
      )
      .mockImplementationOnce(() =>
        makeQuery({
          getResult: {
            id: "file-1",
            paperId: "paper-1",
            r2Key: "papers/paper-1/paper/sample.pdf",
            mimeType: "application/pdf",
            filename: "sample.pdf",
          },
        }),
      );

    const app = await createTestApp();
    const env = createTestEnv({
      BUCKET: {
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        get: vi.fn(async () => null),
        createSignedUrl: vi.fn(async () => {
          throw new Error("presign failed");
        }),
      } as any,
    });

    const res = await app.request(
      "http://localhost/api/papers/paper-1/files/file-1/preview",
      {},
      env as any,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toBe("/api/papers/paper-1/files/file-1/stream");
    expect(body.mimeType).toBe("application/pdf");
    expect(body.filename).toBe("sample.pdf");
  });
});

it("POST /api/papers/:id/files/batch-preview ignores missing files in results", async () => {
  mockDb.select = vi
    .fn()
    .mockImplementationOnce(() =>
      makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
    )
    .mockImplementationOnce(() =>
      makeQuery({
        allResult: [
          {
            id: "file-1",
            mimeType: "image/png",
            filename: "1.png",
            r2Key: "k1",
          },
          // file-2 is missing from DB results
        ],
      }),
    );

  const app = await createTestApp();
  const env = createTestEnv({
    BUCKET: {
      createSignedUrl: vi.fn(async (key) => `https://signed.example/${key}`),
    } as any,
  });

  const res = await app.request(
    "http://localhost/api/papers/paper-1/files/batch-preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
    },
    env as any,
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.previews["file-1"]).toBeDefined();
  expect(body.previews["file-2"]).toBeUndefined();
});

it("POST /api/papers/:id/files/batch-preview returns 404 for invalid paper", async () => {
  mockDb.select = vi
    .fn()
    .mockImplementationOnce(() => makeQuery({ getResult: null }));
  const app = await createTestApp();
  const res = await app.request(
    "http://localhost/api/papers/paper-invalid/files/batch-preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ fileIds: ["file-1"] }),
    },
    createTestEnv() as any,
  );
  expect(res.status).toBe(404);
});

it("POST /api/papers/:id/files/batch-preview returns error if unauthorized", async () => {
  mockDb.select = vi
    .fn()
    .mockImplementationOnce(() =>
      makeQuery({ getResult: { id: "paper-1", visibility: "private" } }),
    );
  const app = await createTestApp();
  const res = await app.request(
    "http://localhost/api/papers/paper-1/files/batch-preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ fileIds: ["file-1"] }),
    },
    createTestEnv() as any,
  );
  expect(res.status).toBe(401);
});

it("POST /api/papers/:id/files/batch-preview falls back to stream URL when signed URL generation fails for some files", async () => {
  mockDb.select = vi
    .fn()
    .mockImplementationOnce(() =>
      makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
    )
    .mockImplementationOnce(() =>
      makeQuery({
        allResult: [
          {
            id: "file-1",
            paperId: "paper-1",
            r2Key: "papers/paper-1/paper/sample1.png",
            mimeType: "image/png",
            filename: "sample1.png",
          },
        ],
      }),
    );

  const app = await createTestApp();
  const env = createTestEnv({
    BUCKET: {
      createSignedUrl: vi.fn(async () => {
        throw new Error("presign failed");
      }),
    } as any,
  });

  const res = await app.request(
    "http://localhost/api/papers/paper-1/files/batch-preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ fileIds: ["file-1"] }),
    },
    env as any,
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.previews["file-1"]).toEqual({
    url: "/api/papers/paper-1/files/file-1/stream",
    mimeType: "image/png",
    filename: "sample1.png",
  });
});

it("GET /api/papers/:id/files/:fileId/preview returns 404 for missing file", async () => {
  mockDb.select = vi
    .fn()
    .mockImplementationOnce(() =>
      makeQuery({ getResult: { id: "paper-1", visibility: "public" } }),
    )
    .mockImplementationOnce(() => makeQuery({ getResult: null }));

  const app = await createTestApp();
  const res = await app.request(
    "http://localhost/api/papers/paper-1/files/file-missing/preview",
    {},
    createTestEnv() as any,
  );
  expect(res.status).toBe(404);
});
