import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/components/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

      if (url === "/api/invites/invite-1" && init?.method === "PATCH") {
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

  it("redirects guests to home", () => {
    authState = { user: null, loading: false };

    render(<InvitesPage />);

    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows empty state when invite fetch fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));

    render(<InvitesPage />);

    expect(await screen.findByText("招待はありません")).toBeInTheDocument();
  });

  it("declines a pending invite and updates the status", async () => {
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

      if (url === "/api/invites/invite-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<InvitesPage />);

    expect(await screen.findByText("Paper title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "拒否" }));

    await waitFor(() => {
      expect(screen.getByText("拒否済み")).toBeInTheDocument();
    });
  });

  it("keeps independent busy states for simultaneous invite responses", async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;

    vi.mocked(apiFetch).mockImplementation((url, init) => {
      if (url === "/api/invites/received") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              invites: [
                {
                  id: "invite-1",
                  paperId: "paper-1",
                  paperTitle: "First paper",
                  inviterId: "user-2",
                  inviterName: "Bob",
                  status: "pending",
                  createdAt: "2026-03-01T00:00:00Z",
                },
                {
                  id: "invite-2",
                  paperId: "paper-2",
                  paperTitle: "Second paper",
                  inviterId: "user-3",
                  inviterName: "Alice",
                  status: "pending",
                  createdAt: "2026-03-02T00:00:00Z",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/invites/invite-1" && init?.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }

      if (url === "/api/invites/invite-2" && init?.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<InvitesPage />);

    const firstItem = (await screen.findByText("First paper")).closest("li");
    const secondItem = screen.getByText("Second paper").closest("li");

    expect(firstItem).not.toBeNull();
    expect(secondItem).not.toBeNull();

    const firstAccept = within(firstItem!).getByRole("button", {
      name: "承認",
    });
    const firstDecline = within(firstItem!).getByRole("button", {
      name: "拒否",
    });

    fireEvent.click(firstAccept);

    await waitFor(() => {
      expect(firstAccept).toBeDisabled();
    });
    expect(firstDecline).toBeDisabled();
    expect(firstAccept).toHaveAttribute("aria-busy", "true");
    expect(firstAccept).toHaveAccessibleName("承認");

    const secondDecline = within(secondItem!).getByRole("button", {
      name: "拒否",
    });

    fireEvent.click(secondDecline);

    await waitFor(() => {
      expect(secondDecline).toBeDisabled();
    });
    expect(secondDecline).toHaveAttribute("aria-busy", "true");
    expect(secondDecline).toHaveAccessibleName("拒否");
    expect(firstAccept).toBeDisabled();

    await act(async () => {
      resolveSecond(new Response("{}", { status: 200 }));
    });

    await waitFor(() => {
      expect(within(secondItem!).getByText("拒否済み")).toBeInTheDocument();
    });
    expect(firstAccept).toBeDisabled();

    await act(async () => {
      resolveFirst(new Response("{}", { status: 200 }));
    });

    await waitFor(() => {
      expect(within(firstItem!).getByText("承認済み")).toBeInTheDocument();
    });
  });
});
