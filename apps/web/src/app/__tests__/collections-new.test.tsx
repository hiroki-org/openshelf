import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewCollectionPage from "../collections/new/page";
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

describe("NewCollectionPage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
  });

  it("slugifies the name, checks availability, and creates a user collection", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }

      if (url === "/api/collections" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ collection: { slug: "lab-picks" } }),
          { status: 201 },
        );
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    expect(screen.getByLabelText("slug")).toHaveValue("lab-picks");

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✓ 使用可能")).toBeInTheDocument();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/users/user-1/c/lab-picks");
    });
  });

  it("requires an org slug for org-owned collections", async () => {
    render(<NewCollectionPage />);

    fireEvent.click(screen.getByLabelText(/^org$/));
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("org slug is required")).toBeInTheDocument();
  });
});
