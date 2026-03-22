import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewOrgPage from "../orgs/new/page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
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

describe("NewOrgPage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
  });

  it("checks slug availability and creates an org", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/orgs/research-lab") {
        return new Response("{}", { status: 404 });
      }

      if (url === "/api/orgs" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ org: { slug: "research-lab" } }),
          { status: 201 },
        );
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewOrgPage />);

    fireEvent.change(screen.getByLabelText(/組織名/i), {
      target: { value: "Research Lab" },
    });

    expect(screen.getByLabelText(/スラッグ/i)).toHaveValue("research-lab");

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✓ 使用可能")).toBeInTheDocument();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/orgs/research-lab");
    });
  });

  it("handles taken and invalid slugs", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 })); // Status 200 means taken

    render(<NewOrgPage />);

    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "taken-slug" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✗ 使用済み")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "ab" }, // Too short
    });
    expect(screen.getByText(/※ 3〜40文字/i)).toBeInTheDocument();
  });

  it("ignores stale availability responses when slug changes", async () => {
    vi.useFakeTimers();
    let resolveFirstRequest: ((value: Response) => void) | undefined;

    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/orgs/first-org") {
        return new Promise<Response>((resolve) => {
          resolveFirstRequest = resolve;
        });
      }

      if (url === "/api/orgs/taken-org") {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewOrgPage />);

    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "first-org" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "taken-org" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✗ 使用済み")).toBeInTheDocument();

    await act(async () => {
      resolveFirstRequest?.(new Response("{}", { status: 404 }));
      await Promise.resolve();
    });

    expect(screen.getByText("✗ 使用済み")).toBeInTheDocument();
    expect(screen.queryByText("✓ 使用可能")).not.toBeInTheDocument();
  });

  it("treats non-404 non-2xx slug checks as idle instead of taken", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));

    render(<NewOrgPage />);

    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "server-error" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.queryByText("✗ 使用済み")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ 使用可能")).not.toBeInTheDocument();
    expect(screen.queryByText("確認中...")).not.toBeInTheDocument();
  });

  it("handles network error and api error during org creation", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/new-org") return new Response("{}", { status: 404 });
      throw new Error("Network Error");
    });

    vi.useFakeTimers();
    render(<NewOrgPage />);
    fireEvent.change(screen.getByLabelText(/組織名/i), { target: { value: "New Org" } });
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(await screen.findByText("ネットワークエラーが発生しました")).toBeInTheDocument();

    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ error: "Conflict" }), { status: 409 }));
    fireEvent.click(screen.getByRole("button", { name: "作成" }));
    expect(await screen.findByText("Conflict")).toBeInTheDocument();
  });
});
