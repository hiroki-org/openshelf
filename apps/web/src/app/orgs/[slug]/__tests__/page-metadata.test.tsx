import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../org-page-client", () => ({
  default: ({ slug }: any) => <div>{`org:${slug}`}</div>,
}));

describe("orgs/[slug]/page metadata", () => {
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

  it("builds org metadata and renders the client page", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { default: OrgPage, generateMetadata } = await import("../page");
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
    expect(metadata.alternates?.types?.["application/atom+xml"]).toBe(
      "https://public-api.example.com/feed/orgs/lab/atom.xml",
    );
    expect(screen.getByText("org:lab")).toBeInTheDocument();
  });

  it("returns fallback metadata title when org is not found", async () => {
    process.env.API_URL = "http://internal-api:8787";
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com";
    vi.resetModules();

    const { generateMetadata } = await import("../page");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 404 }) as any,
    );

    const metadata = await generateMetadata({ params: { slug: "no-such-org" } });

    expect(metadata.title).toBe("組織詳細 | OpenShelf");
    // No atom+xml alternate when org is not found
    expect((metadata as any).alternates?.types?.["application/atom+xml"]).toBeUndefined();
  });

  it("returns minimal metadata and does not throw for invalid slug", async () => {
    vi.resetModules();
    const { generateMetadata } = await import("../page");

    const metadata = await generateMetadata({ params: { slug: "../traversal" } });

    expect(metadata.title).toBe("OpenShelf");
  });

  it("renders invalid identifier message for path-traversal slug", async () => {
    vi.resetModules();
    const { default: OrgPage } = await import("../page");

    const view = await OrgPage({ params: { slug: "../traversal" } });
    render(view);

    expect(screen.getByText("無効な識別子です")).toBeInTheDocument();
  });
});