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
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
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

    expect(screen.getByRole("button", { name: /作成中/ })).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: /作成中/ })
        .querySelector(".animate-spin"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/users/user-1/c/lab-picks");
    });
  });

  it("keeps submit disabled while slug check is still idle (debounce not finished)", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    const submit = screen.getByRole("button", { name: "作成" });
    expect(submit).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument(),
    );
    expect(submit).not.toBeDisabled();
  });

  it("resets slug availability when switching from user to org ownership", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      if (url === "/api/orgs/example-org/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    const submit = screen.getByRole("button", { name: "作成" });
    await waitFor(() =>
      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument(),
    );
    expect(submit).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText(/^org$/));

    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("org slug"), {
      target: { value: "example-org" },
    });

    await waitFor(() =>
      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument(),
    );
    expect(submit).not.toBeDisabled();
  });

  it("requires an org slug for org-owned collections", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/example-org/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.click(screen.getByLabelText(/^org$/));
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    const submit = screen.getByRole("button", { name: "作成" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("org slug"), {
      target: { value: "example-org" },
    });

    await waitFor(() =>
      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument(),
    );
    expect(submit).not.toBeDisabled();
  });

  it("redirects guests to home", () => {
    authState = { user: null, loading: false };

    render(<NewCollectionPage />);

    expect(push).toHaveBeenCalledWith("/");
  });

  it("marks invalid slug formats and keeps submit disabled", async () => {
    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });
    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "bad--slug" },
    });

    expect(
      await screen.findByText("※ 3-40文字, 英小文字/数字/ハイフン"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("shows API error when create fails", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        return new Response(JSON.stringify({ error: "already exists" }), {
          status: 409,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    await waitFor(() =>
      expect(screen.getByText("✓ 使用可能")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("already exists")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
