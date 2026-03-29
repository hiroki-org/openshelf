import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagAutocompleteInput } from "../tag-autocomplete-input";
import { apiFetch } from "@/lib/api";
import { useState } from "react";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

describe("TagAutocompleteInput", () => {
  const DEBOUNCE_WAIT_MS = 350;
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function TestHarness() {
    const [value, setValue] = useState("M");
    return (
      <TagAutocompleteInput
        id="paper-tags"
        value={value}
        onChange={setValue}
        placeholder="タグ"
      />
    );
  }

  it("requests suggestions with 300ms debounce only when query has at least 2 chars", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "ML"] }), {
        status: 200,
      }),
    );

    render(<TestHarness />);

    expect(apiFetch).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText("タグ");
    fireEvent.change(input, { target: { value: "Ma" } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tags/suggest?q=Ma");
    }, { timeout: 600 });
  });

  it("uses cached results for the same prefix and supports keyboard selection", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    const onChange = vi.fn();
    const { rerender } = render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />,
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 600 });

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(await screen.findByRole("option", { name: "Machine Learning" })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("Machine Learning, ");

    rerender(<TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />);
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.getByRole("option", { name: "Machine Learning" })).toBeInTheDocument();
  });

  it("closes the dropdown with Escape and exposes the active descendant", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    render(<TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />);

    const input = screen.getByRole("textbox");
    expect(await screen.findByRole("option", { name: "Machine Learning" })).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "paper-tags-suggestions-option-0",
    );

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("ignores stale suggestion responses for older queries", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: Response) => void) | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;

    vi.mocked(apiFetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
    });
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/tags/suggest?q=Ma");

    rerender(<TagAutocompleteInput id="paper-tags" value="Mat" onChange={vi.fn()} />);

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/api/tags/suggest?q=Mat");

    await act(async () => {
      resolveSecond?.(
        new Response(JSON.stringify({ tags: ["Math"] }), { status: 200 }),
      );
      await Promise.resolve();
    });

    expect(screen.getByRole("option", { name: "Math" })).toBeInTheDocument();

    await act(async () => {
      resolveFirst?.(
        new Response(JSON.stringify({ tags: ["Machine Learning"] }), {
          status: 200,
        }),
      );
      await Promise.resolve();
    });

    expect(screen.queryByRole("option", { name: "Machine Learning" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Math" })).toBeInTheDocument();
  });

  it("renders chips only for committed tags", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="AI, Ma" onChange={vi.fn()} />,
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.queryByText("Ma")).not.toBeInTheDocument();
  });
});
