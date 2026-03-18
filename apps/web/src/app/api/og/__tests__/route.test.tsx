import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    headers: Headers;
    markup: unknown;
    init: unknown;

    constructor(
      markup: unknown,
      init?: { headers?: HeadersInit; width?: number; height?: number },
    ) {
      this.markup = markup;
      this.init = init;
      this.headers = new Headers(init?.headers);
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
    const { GET } = await import("../route");
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

  it("handles different types and truncates long titles", async () => {
    const { GET } = await import("../route");
    const longTitle = "A".repeat(100);
    const response: any = await GET(
      new Request(
        `http://localhost/api/og?type=collection&title=${longTitle}`,
      ),
    );
    expect(response.markup.props.children[0].props.children[1].props.children).toBe("Collection");
    // safeTitle truncation should happen
    const safeTitle = response.markup.props.children[1].props.children[0].props.children;
    expect(safeTitle.length).toBe(83);
    expect(safeTitle.endsWith("...")).toBe(true);
  });

  it("uses default values when search params are missing", async () => {
    const { GET } = await import("../route");
    const response: any = await GET(new Request("http://localhost/api/og"));
    expect(response.markup.props.children[0].props.children[1].props.children).toBe("Paper");
    expect(response.markup.props.children[1].props.children[0].props.children).toBe("OpenShelf");
  });

  it("handles font fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 404 }) as any);
    vi.resetModules();
    const { GET } = await import("../route");
    const response: any = await GET(new Request("http://localhost/api/og"));
    expect(response.init.fonts).toBeUndefined();
  });
});
