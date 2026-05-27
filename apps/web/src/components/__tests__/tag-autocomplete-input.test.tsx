import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledWith("/api/tags/suggest?q=Ma");
      },
      { timeout: 600 },
    );
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

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(
      await screen.findByRole("option", { name: "Machine Learning" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("Machine Learning, ");

    rerender(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />,
    );
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole("textbox"));
    expect(
      screen.getByRole("option", { name: "Machine Learning" }),
    ).toBeInTheDocument();
  });

  it("closes the dropdown with Escape and exposes the active descendant", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    const input = screen.getByRole("textbox");
    expect(
      await screen.findByRole("option", { name: "Machine Learning" }),
    ).toBeInTheDocument();
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

    rerender(
      <TagAutocompleteInput id="paper-tags" value="Mat" onChange={vi.fn()} />,
    );

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

    expect(
      screen.queryByRole("option", { name: "Machine Learning" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Math" })).toBeInTheDocument();
  });

  it("renders chips for all tags including the currently typing tag", () => {
    render(
      <TagAutocompleteInput
        id="paper-tags"
        value="AI, Ma"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Ma")).toBeInTheDocument();
  });

  it("renders chips when tags are separated by full-width delimiters", () => {
    render(
      <TagAutocompleteInput
        id="paper-tags"
        value="AI，機械学習、深層学習"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("機械学習")).toBeInTheDocument();
    expect(screen.getByText("深層学習")).toBeInTheDocument();
  });

  it("renders loading spinner when fetching suggestions", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(
      () =>
        new Promise<Response>(() => {
          // Never resolves
        }),
    );

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
    });

    const spinner = Array.from(document.querySelectorAll('[aria-hidden="true"]')).find(el => el.className.includes('animate-spin'));
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText("候補を取得中...")).toBeInTheDocument();
  });

  it("does not render loading spinner or text when not loading", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="" onChange={vi.fn()} />,
    );
    const spinner = Array.from(document.querySelectorAll('[aria-hidden="true"]')).find(el => el.className.includes('animate-spin'));
    expect(spinner).toBeUndefined();
    expect(screen.queryByText("候補を取得中...")).not.toBeInTheDocument();
  });

  it("resets loading state on fetch error", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network Error"));

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
      await Promise.resolve(); // Flush microtasks to allow the catch block to run
    });

    expect(screen.queryByText("候補を取得中...")).not.toBeInTheDocument();
  });

  it("resets loading state on non-ok response", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
      await Promise.resolve(); // Flush microtasks
    });

    expect(screen.queryByText("候補を取得中...")).not.toBeInTheDocument();
  });

  it("handles fetch with orgSlug", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["OrgTag"] }), { status: 200 }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Org" onChange={vi.fn()} orgSlug="my-org" />,
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/tags/suggest?q=Org&orgSlug=my-org"));
  });

  it("cleans up on unmount when fetch is in progress", () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(
      () =>
        new Promise<Response>(() => {
          // Never resolves
        }),
    );
    const { unmount } = render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
    vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
    unmount();
  });

  it("handles empty values gracefully", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="" onChange={vi.fn()} />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("closes suggestions on blur after a delay", async () => {
    vi.useFakeTimers();
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    await act(async () => {
      vi.advanceTimersByTime(150); // wait for BLUR_DELAY_MS
    });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("cleans up timeout on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    unmount();
    // No explicit assertion, just verifying it doesn't throw during unmount cleanup
  });

  it("navigates down suggestions with ArrowDown", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), { status: 200 }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(await screen.findByRole("option", { name: "Machine Learning" })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Math" })).toHaveAttribute("aria-selected", "true"); // Initially it's index 0, ArrowDown highlights 1

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "paper-tags-suggestions-option-0"); // Loops to start
  });

  it("navigates up suggestions with ArrowUp", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), { status: 200 }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect(await screen.findByRole("option", { name: "Machine Learning" })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "paper-tags-suggestions-option-1"); // Goes to end

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "paper-tags-suggestions-option-0");
  });

  it("selects suggestion with mouse click", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning"] }), { status: 200 }),
    );
    const onChange = vi.fn();
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />,
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    const option = await screen.findByRole("option", { name: "Machine Learning" });
    fireEvent.mouseDown(option); // should prevent default
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("Machine Learning, ");
  });

  it("ignores Enter when no valid suggestion is highlighted", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
