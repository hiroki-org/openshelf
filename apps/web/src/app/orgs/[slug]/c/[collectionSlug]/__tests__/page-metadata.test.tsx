import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../org-collection-page-client", () => ({
  default: ({ slug, collectionSlug }: any) => (
    <div>{`org-collection:${slug}:${collectionSlug}`}</div>
  ),
}));

import OrgCollectionPage, { generateMetadata } from "../page";

describe("orgs/[slug]/c/[collectionSlug]/page metadata", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds org collection metadata and handles invalid params", async () => {
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
    const view = await OrgCollectionPage({
      params: { slug: "../bad", collectionSlug: "featured" },
    });
    render(view);

    expect(metadata.title).toBe("Featured | Research Lab | OpenShelf");
    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });
});
