import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../org-collection-page-client", () => ({
  default: ({ slug, collectionSlug }: any) => (
    <div>{`org-collection:${slug}:${collectionSlug}`}</div>
  ),
}));

describe("orgs/[slug]/c/[collectionSlug]/page metadata", () => {
  const originalApiUrl = process.env.API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    cleanup();
    if (originalApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = originalApiUrl;

    if (originalPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;

    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds org collection metadata", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();
    const { generateMetadata } = await import("../page");

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            org: { slug: "lab", name: "Research Lab" },
          }),
          { status: 200 },
        ) as any,
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
        ) as any,
      );

    const metadata = await generateMetadata({
      params: { slug: "lab", collectionSlug: "featured" },
    });

    expect(metadata.title).toBe("Featured | Research Lab | OpenShelf");
    expect(metadata.alternates?.types?.["application/atom+xml"]).toBe(
      "https://public-api.example.com/feed/orgs/lab/collections/featured/atom.xml",
    );
  });

  it("renders an invalid identifier message for invalid params", async () => {
    const { default: OrgCollectionPage } = await import("../page");
    const view = await OrgCollectionPage({
      params: { slug: "../bad", collectionSlug: "featured" },
    });
    render(view);

    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });
});
