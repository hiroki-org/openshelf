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
});
