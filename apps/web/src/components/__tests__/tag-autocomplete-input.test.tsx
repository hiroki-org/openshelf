import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("Machine Learning, ");

    rerender(<TagAutocompleteInput id="paper-tags" value="Ma" onChange={onChange} />);
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.getByRole("option", { name: "Machine Learning" })).toBeInTheDocument();
  });
});
