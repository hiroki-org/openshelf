import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../settings/page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
const refresh = vi.fn();
let authState: any;

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

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    refresh.mockReset();
    authState = {
      user: { id: "user-1", name: "alice", displayName: "Alice" },
      loading: false,
      refresh,
    };
  });

  it("saves the display name and refreshes the auth state", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 }));

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "  Alice Cooper  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/users/me",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ displayName: "Alice Cooper" }),
        }),
      );
    });

    expect(await screen.findByText("保存しました")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows non-JSON error responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response("Plain text error", { status: 400 }),
    );

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("Plain text error")).toBeInTheDocument();
  });
});
