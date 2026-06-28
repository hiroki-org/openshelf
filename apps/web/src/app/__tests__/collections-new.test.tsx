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
  const expectSlugStatus = (text: string, icon: string) => {
    const status = screen.getByText(
      (_content, element) =>
        element?.id === "slug-status" && element.textContent === text,
    );

    expect(status).toBeInTheDocument();
    expect(status.querySelector('[aria-hidden="true"]')).toHaveTextContent(icon);
  };

  const expectSlugAvailable = () => expectSlugStatus("✓ 使用可能", "✓");

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
  });

  it("updates name and description counters with consistent warning thresholds", () => {
    render(<NewCollectionPage />);

    const name = screen.getByLabelText("name");
    const description = screen.getByLabelText("description");

    expect(name).toHaveAttribute("aria-describedby", "name-counter");
    expect(description).toHaveAttribute("aria-describedby", "description-counter");
    expect(screen.getByText("0/100")).toHaveAttribute("id", "name-counter");
    expect(screen.getByText("0/500")).toHaveAttribute(
      "id",
      "description-counter",
    );

    fireEvent.change(name, { target: { value: "x".repeat(89) } });
    expect(screen.getByText("89/100")).toHaveClass("text-gray-500");

    fireEvent.change(name, { target: { value: "x".repeat(90) } });
    expect(screen.getByText("90/100")).toHaveClass("text-red-500");
    expect(screen.getByText("90/100")).toHaveClass("dark:text-red-400");

    fireEvent.change(description, { target: { value: "x".repeat(449) } });
    expect(screen.getByText("449/500")).toHaveClass("text-gray-500");

    fireEvent.change(description, { target: { value: "x".repeat(450) } });
    expect(screen.getByText("450/500")).toHaveClass("text-red-500");
    expect(screen.getByText("450/500")).toHaveClass("dark:text-red-400");
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

    expectSlugAvailable();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/users/user-1/c/lab-picks");
    });
  });

  it("shows a spinner while creating a collection", async () => {
    vi.useFakeTimers();
    let resolveCreate!: (value: Response) => void;
    vi.mocked(apiFetch).mockImplementation((url, init) => {
      if (url === "/api/users/user-1/collections") {
        return Promise.resolve(
          new Response(JSON.stringify({ collections: [] }), {
            status: 200,
          }),
        );
      }

      if (url === "/api/collections" && init?.method === "POST") {
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${String(url)}`));
    });

    const { container } = render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expectSlugAvailable();

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByRole("button", { name: "作成中..." }),
    ).toBeDisabled();
    expect(
      container.querySelector('[aria-hidden="true"].animate-spin'),
    ).toBeInTheDocument();

    resolveCreate(
      new Response(JSON.stringify({ collection: { slug: "lab-picks" } }), {
        status: 201,
      }),
    );

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

    await waitFor(() => expectSlugAvailable());
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
    await waitFor(() => expectSlugAvailable());
    expect(submit).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText(/^org$/));

    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("org slug"), {
      target: { value: "example-org" },
    });

    await waitFor(() => expectSlugAvailable());
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

    await waitFor(() => expectSlugAvailable());
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

  it("marks taken slug status with decorative icon hidden from assistive tech", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({ collections: [{ slug: "lab-picks" }] }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    await waitFor(() => expectSlugStatus("✗ 使用済み", "✗"));
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

    await waitFor(() => expectSlugAvailable());
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("already exists")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
