import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    headers = new Headers();
    markup: unknown;
    init: unknown;

    constructor(markup: unknown, init: unknown) {
      this.markup = markup;
      this.init = init;
    }
  },
}));

describe("OG route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(new ArrayBuffer(8), { status: 200 }) as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an image response with cache headers", async () => {
    const { GET } = await import("../api/og/route");
    const response: any = await GET(
      new Request(
        "http://localhost/api/og?type=org&title=Research%20Lab&subtitle=Artifacts",
      ),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=86400",
    );
    expect(response.init).toEqual(
      expect.objectContaining({
        width: 1200,
        height: 630,
      }),
    );
  });
});
