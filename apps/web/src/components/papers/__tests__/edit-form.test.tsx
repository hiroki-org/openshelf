import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaperEditForm, PaperEditData } from "../edit-form";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("PaperEditForm", () => {
  const defaultInitialData: PaperEditData = {
    title: "Original",
    abstract: null,
    visibility: "public",
    showViewCount: false,
    language: null,
    externalUrl: null,
    doi: null,
    venue: null,
    venueType: null,
    year: null,
    category: null,
    tags: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows validation error when title is empty", async () => {
    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("タイトルを入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows validation error when title exceeds 300 characters", async () => {
    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    const longTitle = "A".repeat(301);
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: longTitle } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("タイトルは300文字以内で入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows validation error when abstract exceeds 5000 characters", async () => {
    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    const longAbstract = "A".repeat(5001);
    fireEvent.change(screen.getByLabelText(/概要/i), { target: { value: longAbstract } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("概要は5000文字以内で入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("handles non-array valid JSON and invalid JSON tags gracefully", async () => {
    // 1. Valid JSON, but not an array (Object)
    const { unmount } = render(
      <PaperEditForm
        paperId="paper-1"
        initialData={{ ...defaultInitialData, tags: '{"not": "an array"}' }}
      />
    );
    expect(screen.getByLabelText(/タグ/i)).toHaveValue('[object Object]'); // Falls back to String(parsed)
    unmount();

    // 2. Invalid JSON string
    render(
      <PaperEditForm
        paperId="paper-1"
        initialData={{ ...defaultInitialData, tags: 'invalid-json, test' }}
      />
    );
    expect(screen.getByLabelText(/タグ/i)).toHaveValue('invalid-json, test'); // Falls back to String(initialData.tags)
  });

  it("submits the form successfully and redirects", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 }));

    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "New Title" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"title":"New Title"')
        })
      );
    });

    expect(push).toHaveBeenCalledWith("/papers/paper-1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });


  it("shows error when year is invalid", async () => {
    // Override the component state by forcing an invalid year that parses as NaN.
    // We don't use fireEvent.change for the year input because jsdom will wipe out invalid chars on type="number".
    render(<PaperEditForm paperId="paper-1" initialData={{...defaultInitialData, year: "NaN" as any}} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Valid Title" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("年は数値で入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows server error on failed submission", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "サーバーエラーが発生しました" }), { status: 500 })
    );

    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Valid Title" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("サーバーエラーが発生しました")).toBeInTheDocument();
    });
  });

  it("shows fallback error if no error message is provided by the server", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 })
    );

    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Valid Title" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("メタデータの更新に失敗しました")).toBeInTheDocument();
    });
  });



  it("handles form inputs appropriately and maps to the payload", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 }));

    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    // Change various fields to trigger onChange handlers and cover those lines
    fireEvent.change(screen.getByLabelText(/カテゴリ/i), { target: { value: "report" } });
    fireEvent.change(screen.getByLabelText(/発表場所（学会名など）/i), { target: { value: "Test Venue" } });
    fireEvent.change(screen.getByLabelText(/発表種別/i), { target: { value: "conference" } });
    fireEvent.change(screen.getByLabelText(/言語/i), { target: { value: "ja" } });
    fireEvent.change(screen.getByLabelText(/DOI/i), { target: { value: "10.1000/182" } });
    fireEvent.change(screen.getByLabelText(/外部リンク/i), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByLabelText(/公開ページに閲覧数を表示する/i));
    fireEvent.change(screen.getByLabelText(/タグ/i), { target: { value: "AI, test" } });

    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"category":"report"')
        })
      );
    });

    const calls = vi.mocked(apiFetch).mock.calls;
    const bodyStr = (calls[0][1] as RequestInit).body as string;
    const body = JSON.parse(bodyStr);

    expect(body.venue).toBe("Test Venue");
    expect(body.venueType).toBe("conference");
    expect(body.language).toBe("ja");
    expect(body.doi).toBe("10.1000/182");
    expect(body.externalUrl).toBe("https://example.com");
    expect(body.showViewCount).toBe(true);
    expect(body.tags).toEqual(["AI", "test"]);
  });

});
