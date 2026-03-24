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

  it("allows manual slug override, changes owner type and handles visibility", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ collection: { slug: "custom-slug-123" } }),
          { status: 201 }
        );
      }
      return new Response(null, { status: 200 });
    });

    render(<NewCollectionPage />);

    // Change to org and back to user to cover line 183
    fireEvent.click(screen.getByLabelText(/^org$/));
    fireEvent.click(screen.getByLabelText(/^user$/));

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    // Manually edit the slug to cover line 241-242
    fireEvent.change(screen.getByLabelText("slug"), {
      target: { value: "custom-slug-123" },
    });

    // Change visibility
    fireEvent.change(screen.getByLabelText("visibility"), {
      target: { value: "org_only" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/users/user-1/c/custom-slug-123");
    });
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


  it("blocks submit while slug availability check is pending", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    const button = screen.getByRole("button", { name: "作成" });
    expect(button).toBeDisabled();

    const form = button.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(screen.getByText("slug の確認完了を待ってください")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✓ 使用可能")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).not.toBeDisabled();
  });

  it("disables submit for org-owned collections until org slug is entered", async () => {
    vi.useFakeTimers();
    render(<NewCollectionPage />);

    fireEvent.click(screen.getByLabelText(/^org$/));
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Lab Picks" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("handles 400 error response from api", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        return new Response(JSON.stringify({ error: "custom validation error" }), { status: 400 });
      }
      return new Response(null, { status: 200 });
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Test Error" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("custom validation error")).toBeInTheDocument();
  });

  it("submits description and visibility correctly", async () => {
    vi.useFakeTimers();
    let submittedBody = null;
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        submittedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ collection: { slug: "my-collection" } }),
          { status: 201 }
        );
      }
      return new Response(null, { status: 200 });
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Test Collection" },
    });

    fireEvent.change(screen.getByLabelText("description"), {
      target: { value: "A description here" },
    });

    fireEvent.change(screen.getByLabelText("visibility"), {
      target: { value: "public" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/users/user-1/c/my-collection");
    });

    expect(submittedBody).toMatchObject({
      description: "A description here",
      visibility: "public"
    });
  });

  it("creates an org collection successfully", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/orgs/my-org/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ collection: { slug: "my-collection" } }),
          { status: 201 }
        );
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<NewCollectionPage />);

    fireEvent.click(screen.getByLabelText(/^org$/));

    const orgSlugInput = screen.getByLabelText("org slug");
    fireEvent.change(orgSlugInput, { target: { value: "my-org" } });

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "my collection" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/orgs/my-org/c/my-collection");
    });
  });

  it("displays network error on API failure during submission", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      if (url === "/api/collections" && init?.method === "POST") {
        throw new Error("Network failure");
      }
      return new Response(null, { status: 200 });
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Test Error" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("ネットワークエラー")).toBeInTheDocument();
  });

  it("handles slug already taken checking error", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [{slug: "taken-slug"}] }), { status: 200 });
      }
      return new Response(null, { status: 200 });
    });

    render(<NewCollectionPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "taken slug" },
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByText("✗ 使用済み")).toBeInTheDocument();

    // Validate we cannot click the button if it's taken
    const button = screen.getByRole("button", { name: "作成" });
    expect(button).toBeDisabled();
  });
});
