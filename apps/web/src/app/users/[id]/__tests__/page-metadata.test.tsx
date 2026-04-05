import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../user-page-client", () => ({
  default: ({ id }: { id: string }) => <div>{`user:${id}`}</div>,
}));

describe("users/[id]/page metadata", () => {
  const originalApiUrl = process.env.API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    cleanup();
    process.env.API_URL = originalApiUrl;
    process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds user metadata and renders the client page", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { default: UserPage, generateMetadata } = await import("../page");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            name: "Alice",
            displayName: "Alice A.",
            githubId: "alice",
          },
        }),
        { status: 200 },
      ) as Response,
    );

    const metadata = await generateMetadata({ params: { id: "user-1" } });
    const view = await UserPage({ params: { id: "user-1" } });
    render(view);

    expect(metadata.title).toBe("Alice A. | OpenShelf");
    expect(metadata.alternates?.types?.["application/atom+xml"]).toContain(
      "https://public-api.example.com/feed/users/user-1/atom.xml",
    );
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
  });

  it("returns fallback title when user is not found but still includes atom feed link", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { generateMetadata } = await import("../page");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 404 }) as Response,
    );

    const metadata = await generateMetadata({ params: { id: "user-missing" } });

    expect(metadata.title).toBe("ユーザー詳細 | OpenShelf");
    // Feed link is always emitted even when user data is absent
    expect(metadata.alternates?.types?.["application/atom+xml"]).toContain(
      "/feed/users/user-missing/atom.xml",
    );
  });

  it("uses name when displayName is null", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { generateMetadata } = await import("../page");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "user-2",
            name: "Bob",
            displayName: null,
            githubId: "bob",
          },
        }),
        { status: 200 },
      ) as Response,
    );

    const metadata = await generateMetadata({ params: { id: "user-2" } });

    expect(metadata.title).toBe("Bob | OpenShelf");
  });

  it("returns OpenShelf title for an invalid id that safePath rejects", async () => {
    vi.resetModules();

    const { generateMetadata } = await import("../page");

    const metadata = await generateMetadata({ params: { id: "../evil" } });

    expect(metadata.title).toBe("OpenShelf");
  });
});