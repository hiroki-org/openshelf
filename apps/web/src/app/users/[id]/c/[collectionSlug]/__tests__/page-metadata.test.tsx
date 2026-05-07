import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../user-collection-page-client", () => ({
  default: ({ id, collectionSlug }: { id: string; collectionSlug: string }) => (
    <div>{`user-collection:${id}:${collectionSlug}`}</div>
  ),
}));

describe("users/[id]/c/[collectionSlug]/page metadata", () => {
  const originalApiUrl = process.env.API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    cleanup();
    if (originalApiUrl === undefined) {
      delete process.env.API_URL;
    } else {
      process.env.API_URL = originalApiUrl;
    }

    if (originalPublicApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;
    }

    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds user collection metadata and renders the client page", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { default: UserCollectionPage, generateMetadata } = await import(
      "../page"
    );

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: "user-1", name: "Alice", displayName: "Alice A." },
          }),
          { status: 200 },
        ) as Response,
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            collections: [
              {
                slug: "featured",
                name: "Featured",
                description: "Featured papers",
              },
            ],
          }),
          { status: 200 },
        ) as Response,
      );

    const metadata = await generateMetadata({
      params: { id: "user-1", collectionSlug: "featured" },
    });
    const view = await UserCollectionPage({
      params: { id: "user-1", collectionSlug: "featured" },
    });
    render(view);

    expect(metadata.title).toBe("Featured | Alice A. | OpenShelf");
    expect(metadata.alternates?.types?.["application/atom+xml"]).toBe(
      "https://public-api.example.com/feed/users/user-1/collections/featured/atom.xml",
    );
    expect(
      screen.getByText("user-collection:user-1:featured"),
    ).toBeInTheDocument();
  });

  it("renders invalid identifier message for invalid params", async () => {
    const { default: UserCollectionPage } = await import("../page");
    const view = await UserCollectionPage({
      params: { id: "../bad", collectionSlug: "featured" },
    });
    render(view);

    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });
});
