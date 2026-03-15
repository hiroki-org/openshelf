import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../papers/[id]/paper-detail-client", () => ({
  default: ({ paperId }: any) => <div>{`paper:${paperId}`}</div>,
}));

vi.mock("../orgs/[slug]/org-page-client", () => ({
  default: ({ slug }: any) => <div>{`org:${slug}`}</div>,
}));

vi.mock("../orgs/[slug]/c/[collectionSlug]/org-collection-page-client", () => ({
  default: ({ slug, collectionSlug }: any) => (
    <div>{`org-collection:${slug}:${collectionSlug}`}</div>
  ),
}));

import PaperPage, {
  generateMetadata as generatePaperMetadata,
} from "../papers/[id]/page";
import OrgPage, {
  generateMetadata as generateOrgMetadata,
} from "../orgs/[slug]/page";
import OrgCollectionPage, {
  generateMetadata as generateOrgCollectionMetadata,
} from "../orgs/[slug]/c/[collectionSlug]/page";

describe("page metadata and wrappers", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds paper metadata for public papers", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          paper: {
            id: "paper-1",
            title: "Paper One",
            abstract: "A concise abstract",
            visibility: "public",
          },
          authors: [{ name: "Alice", displayName: null }],
        }),
        { status: 200 },
      ) as any,
    );

    const metadata = await generatePaperMetadata({ params: { id: "paper-1" } });
    const view = await PaperPage({ params: { id: "paper-1" } });
    render(view);

    expect(metadata.title).toBe("Paper One | OpenShelf");
    expect(screen.getByText("paper:paper-1")).toBeInTheDocument();
  });

  it("returns generic paper metadata for invalid identifiers", async () => {
    const metadata = await generatePaperMetadata({ params: { id: "../bad" } });
    const view = await PaperPage({ params: { id: "../bad" } });
    render(view);

    expect(metadata.title).toBe("論文詳細 | OpenShelf");
    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });

  it("builds org metadata and renders the client page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          org: {
            slug: "lab",
            name: "Research Lab",
            description: "Lab description",
          },
        }),
        { status: 200 },
      ) as any,
    );

    const metadata = await generateOrgMetadata({ params: { slug: "lab" } });
    const view = await OrgPage({ params: { slug: "lab" } });
    render(view);

    expect(metadata.title).toBe("Research Lab | OpenShelf");
    expect(screen.getByText("org:lab")).toBeInTheDocument();
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

    const metadata = await generateOrgCollectionMetadata({
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
