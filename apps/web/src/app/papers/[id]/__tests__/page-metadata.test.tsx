import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../paper-detail-client", () => ({
  default: ({ paperId }: any) => <div>{`paper:${paperId}`}</div>,
}));

import PaperPage, { generateMetadata } from "../page";

describe("papers/[id]/page metadata", () => {
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

    const metadata = await generateMetadata({ params: { id: "paper-1" } });
    const view = await PaperPage({ params: { id: "paper-1" } });
    render(view);

    expect(metadata.title).toBe("Paper One | OpenShelf");
    expect(screen.getByText("paper:paper-1")).toBeInTheDocument();
  });

  it("returns generic paper metadata for invalid identifiers", async () => {
    const metadata = await generateMetadata({ params: { id: "../bad" } });
    const view = await PaperPage({ params: { id: "../bad" } });
    render(view);

    expect(metadata.title).toBe("成果物詳細 | OpenShelf");
    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });

  it("returns generic metadata when the API cannot load a paper", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404 }) as any,
    );

    const metadata = await generateMetadata({ params: { id: "missing" } });

    expect(metadata.title).toBe("成果物詳細 | OpenShelf");
    expect(metadata.openGraph?.title).toBe("成果物詳細 | OpenShelf");
    expect(metadata.twitter?.title).toBe("成果物詳細 | OpenShelf");
  });

  it("returns generic metadata when the API request throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network"));

    const metadata = await generateMetadata({ params: { id: "offline" } });

    expect(metadata.title).toBe("成果物詳細 | OpenShelf");
  });

  it("returns generic metadata for non-public papers", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          paper: {
            id: "paper-1",
            title: "Private Paper",
            abstract: "Private abstract",
            visibility: "private",
          },
          authors: [{ name: "Alice", displayName: null }],
        }),
        { status: 200 },
      ) as any,
    );

    const metadata = await generateMetadata({ params: { id: "paper-1" } });

    expect(metadata.title).toBe("成果物詳細 | OpenShelf");
    expect(metadata.openGraph?.title).toBe("成果物詳細 | OpenShelf");
  });


  it("generates generic metadata when id is invalid", async () => {
    // Generate metadata without await as the component is sync for generating metadata via props
    const metadata = await generateMetadata({ params: { id: "../bad" } });
    expect(metadata.title).toBe("成果物詳細 | OpenShelf");
  });

});
