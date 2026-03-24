import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../org-page-client", () => ({
  default: ({ slug }: any) => <div>{`org:${slug}`}</div>,
}));

import OrgPage, { generateMetadata } from "../page";

describe("orgs/[slug]/page metadata", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

    const metadata = await generateMetadata({ params: { slug: "lab" } });
    const view = await OrgPage({ params: { slug: "lab" } });
    render(view);

    expect(metadata.title).toBe("Research Lab | OpenShelf");
    expect(screen.getByText("org:lab")).toBeInTheDocument();
  });

  it("handles fetch failure in generateMetadata", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 404 }));
    const metadata = await generateMetadata({ params: { slug: "lab" } });
    expect(metadata.title).toBe("組織詳細 | OpenShelf");
  });

  it("handles network failure in generateMetadata", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Fail"));
    const metadata = await generateMetadata({ params: { slug: "lab" } });
    expect(metadata.title).toBe("組織詳細 | OpenShelf");
  });

  it("handles invalid slug in OrgPage and generateMetadata", async () => {
    const invalidSlug = "../invalid";
    const metadata = await generateMetadata({ params: { slug: invalidSlug } });
    expect(metadata.title).toBe("OpenShelf");

    const view = await OrgPage({ params: { slug: invalidSlug } });
    render(view);
    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });
});
