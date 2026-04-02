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
    expect(metadata.alternates?.types?.["application/atom+xml"]).toContain(
      "/feed/orgs/lab/atom.xml",
    );
    expect(screen.getByText("org:lab")).toBeInTheDocument();
  });
});
