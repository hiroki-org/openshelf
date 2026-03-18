import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvitesPage from "../page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
type AuthState = {
  user: { id: string } | null;
  loading: boolean;
};

let authState: AuthState;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("InvitesPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
  });

  it("shows an empty state when there are no invites", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ invites: [] }), { status: 200 }),
    );

    render(<InvitesPage />);

    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });

  it("accepts a pending invite and updates the status", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/invites/received") {
        return new Response(
          JSON.stringify({
            invites: [
              {
                id: "invite-1",
                paperId: "paper-1",
                paperTitle: "Paper title",
                inviterId: "user-2",
                inviterName: "Bob",
                status: "pending",
                createdAt: "2026-03-01T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (
        url === "/api/invites/invite-1" &&
        init?.method === "PATCH"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        if (body.action !== "accept") {
          return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
          });
        }
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<InvitesPage />);

    expect(await screen.findByText("Paper title")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "承認" }));

    await waitFor(() => {
      expect(screen.getByText("承認済み")).toBeInTheDocument();
    });
  });

  it("declines a pending invite and updates the status", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/invites/received") {
        return new Response(
          JSON.stringify({
            invites: [
              {
                id: "invite-2",
                paperId: "paper-2",
                paperTitle: "Declined Paper",
                inviterId: "user-2",
                inviterName: "Bob",
                status: "pending",
                createdAt: "2026-03-01T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url === "/api/invites/invite-2" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<InvitesPage />);

    expect(await screen.findByText("Declined Paper")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "拒否" }));

    await waitFor(() => {
      expect(screen.getByText("拒否済み")).toBeInTheDocument();
    });
  });

  it("handles fetch failure (500)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));
    render(<InvitesPage />);
    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });

  it("handles fetch network error", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network Error"));
    render(<InvitesPage />);
    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });

  it("handles respond failure", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/invites/received") {
        return new Response(
          JSON.stringify({
            invites: [{ id: "i1", paperTitle: "T1", status: "pending" }],
          }),
          { status: 200 },
        );
      }
      throw new Error("Patch fail");
    });

    render(<InvitesPage />);
    expect(await screen.findByText("T1")).toBeInTheDocument();

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    // Status should still be pending
    expect(screen.getByText("保留中")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("redirects guests to home", async () => {
    authState = { user: null, loading: false };
    render(<InvitesPage />);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("handles empty invites response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ invites: [] }), { status: 200 }));
    render(<InvitesPage />);
    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });

  it("handles non-ok response from fetch", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("Error", { status: 400 }));
    render(<InvitesPage />);
    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });
});
