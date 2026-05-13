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

  it("shows JSON error responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Validation failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
  });

  it("shows network error message when request throws", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network down"));

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("ネットワークエラーが発生しました"),
    ).toBeInTheDocument();
  });

  it("redirects to home when user is not authenticated", async () => {
    authState = { user: null, loading: false, refresh };

    render(<SettingsPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("sends null display name when the input is blank", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 }));

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/users/me",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ displayName: null }),
        }),
      );
    });
  });

  it("shows fallback error for JSON responses without an error message", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: "missing" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("エラーが発生しました")).toBeInTheDocument();
  });

  it("shows fallback error when JSON parsing fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response("not-json", {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("エラーが発生しました")).toBeInTheDocument();
  });

  it("renders null while auth is loading", () => {
    authState = { user: null, loading: true, refresh };

    const { container } = render(<SettingsPage />);
    expect(container).toBeEmptyDOMElement();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows github username in preview when display name is blank", () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "   " },
    });

    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("keeps fallback message for empty non-JSON error body", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("", { status: 400 }));

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("エラーが発生しました")).toBeInTheDocument();
  });
});
