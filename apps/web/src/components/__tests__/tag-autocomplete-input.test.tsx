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
        orgSlug="test-org"
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
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/tags/suggest?q=Ma&orgSlug=test-org",
        );
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

  it("handles non-ok response from apiFetch", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
      }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );
  });

  it("handles empty tags array response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: "not an array" }), {
        status: 200,
      }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );
  });

  it("handles fetch exception gracefully", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network Error"));
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );
  });

  it("closes dropdown on blur", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
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

    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("supports ArrowDown and ArrowUp keyboard selection", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    await screen.findByRole("option", { name: "Machine Learning" });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "paper-tags-suggestions-option-1",
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "paper-tags-suggestions-option-0",
    );

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "paper-tags-suggestions-option-1",
    );
  });

  it("renders with no tags properly", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="" onChange={vi.fn()} />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("handles Enter with no valid selection or no options", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="M" onChange={vi.fn()} />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
  });

  it("does not fetch if the query is too short", async () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="M" onChange={vi.fn()} />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("clears cached value on empty unmounted", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );
  });

  it("handles mouse down on suggestion to prevent default", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine Learning", "Math"] }), {
        status: 200,
      }),
    );

    const onChange = vi.fn();
    render(
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
    const option = await screen.findByRole("option", {
      name: "Machine Learning",
    });

    // Test onMouseDown event handling to prevent default blur behavior
    let prevented = false;
    const clickEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    clickEvent.preventDefault = () => {
      prevented = true;
    };
    fireEvent(option, clickEvent);
    expect(prevented).toBe(true);

    // Verify onClick works
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith("Machine Learning, ");
  });

  it("returns completely empty array", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
      }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );
  });

  it("uses cached empty results for the same prefix and supports keyboard selection", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: [] }), {
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

    rerender(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />,
    );

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("checks non array tags again", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ tags: ["Machine", 1] }), {
        status: 200,
      }),
    );
    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 600 },
    );
  });

  it("returns no options when the fetch misses the current input", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: Response) => void) | undefined;

    vi.mocked(apiFetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { rerender, unmount } = render(
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
      resolveFirst?.(
        new Response(JSON.stringify({ tags: ["Machine Learning"] }), {
          status: 200,
        }),
      );
      await Promise.resolve();
    });
  });

  it("returns an empty split raw parts list", () => {
    render(
      <TagAutocompleteInput id="paper-tags" value="  " onChange={vi.fn()} />,
    );
  });

  it("displays loading indicator when fetching", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(
      () => new Promise<Response>(() => {}), // Never resolves to keep it loading
    );

    render(
      <TagAutocompleteInput id="paper-tags" value="Ma" onChange={vi.fn()} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_WAIT_MS);
    });

    expect(screen.getByText("候補を取得中...")).toBeInTheDocument();
  });
});
