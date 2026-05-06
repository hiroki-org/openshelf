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
    if (originalApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = originalApiUrl;

    if (originalPublicApiUrl === undefined)
      delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;

    vi.restoreAllMocks();
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
});
