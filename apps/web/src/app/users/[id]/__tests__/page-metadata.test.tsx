import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../user-page-client", () => ({
  default: ({ id }: { id: string }) => <div>{`user:${id}`}</div>,
}));

import UserPage, { generateMetadata } from "../page";

describe("users/[id]/page metadata", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds user metadata and renders the client page", async () => {
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
      "/feed/users/user-1/atom.xml",
    );
    expect(screen.getByText("user:user-1")).toBeInTheDocument();
  });
});
