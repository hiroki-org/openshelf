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

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/orgs/research-lab");
    });
  });
});
