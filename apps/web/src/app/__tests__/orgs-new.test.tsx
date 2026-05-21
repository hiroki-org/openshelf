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

  it("updates the description character counter and keeps it associated with the textarea", () => {
    render(<NewOrgPage />);

    const description = screen.getByLabelText(/説明/i);
    const counter = screen.getByText("0/500");

    expect(description).toHaveAttribute(
      "aria-describedby",
      "org-description-counter",
    );
    expect(counter).toHaveAttribute("id", "org-description-counter");
    expect(counter).toHaveClass("text-gray-500");

    fireEvent.change(description, { target: { value: "abc" } });

    expect(screen.getByText("3/500")).toBeInTheDocument();

    fireEvent.change(description, { target: { value: "x".repeat(500) } });

    expect(screen.getByText("500/500")).toHaveClass("text-red-600");
  });

  it("checks slug availability and creates an org", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/orgs/research-lab") {
        return new Response("{}", { status: 404 });
      }

      if (url === "/api/orgs" && init?.method === "POST") {
        return new Response(JSON.stringify({ org: { slug: "research-lab" } }), {
          status: 201,
        });
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

    expect(screen.getByRole("button", { name: /作成中/ })).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: /作成中/ })
        .querySelector(".animate-spin"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/orgs/research-lab");
    });
  });

  it("redirects guests to home", () => {
    authState = { user: null, loading: false };

    render(<NewOrgPage />);

    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows invalid slug feedback for malformed slug", async () => {
    render(<NewOrgPage />);

    fireEvent.change(screen.getByLabelText(/組織名/i), {
      target: { value: "Research Lab" },
    });
    fireEvent.change(screen.getByLabelText(/スラッグ/i), {
      target: { value: "bad--slug" },
    });

    expect(
      await screen.findByText("※ 3〜40文字、英小文字・数字・ハイフンのみ"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("shows server error when org creation fails", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/orgs/research-lab") {
        return new Response("{}", { status: 404 });
      }
      if (url === "/api/orgs" && init?.method === "POST") {
        return new Response(JSON.stringify({ error: "slug taken" }), {
          status: 409,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    try {
      render(<NewOrgPage />);
      fireEvent.change(screen.getByLabelText(/組織名/i), {
        target: { value: "Research Lab" },
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
        await Promise.resolve();
      });

      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("slug taken")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
