import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MarkdownEditor } from "../markdown-editor";

// Mock the MarkdownRenderer since we only want to test the editor's logic
vi.mock("../markdown-renderer", () => ({
  MarkdownRenderer: ({ markdown }: { markdown: string }) => (
    <div data-testid="mock-markdown-renderer">{markdown}</div>
  ),
}));

describe("MarkdownEditor", () => {
  const mockOnChange = vi.fn();
  const mockOnModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    value: "Initial content",
    onChange: mockOnChange,
    mode: "write" as const,
    onModeChange: mockOnModeChange,
  };

  it("renders in write mode correctly", () => {
    render(<MarkdownEditor {...defaultProps} />);

    // Write tab is selected
    const writeTab = screen.getByRole("tab", { name: "Write" });
    expect(writeTab).toHaveAttribute("aria-selected", "true");

    // Textarea is displayed
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Initial content");

    // Preview panel is not displayed
    expect(screen.queryByTestId("mock-markdown-renderer")).not.toBeInTheDocument();
  });

  it("renders in preview mode correctly", () => {
    render(<MarkdownEditor {...defaultProps} mode="preview" />);

    // Preview tab is selected
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    expect(previewTab).toHaveAttribute("aria-selected", "true");

    // Textarea is not displayed
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // Mock MarkdownRenderer is displayed with the correct content
    const renderer = screen.getByTestId("mock-markdown-renderer");
    expect(renderer).toBeInTheDocument();
    expect(renderer).toHaveTextContent("Initial content");
  });

  it("calls onChange when typing in the textarea", () => {
    render(<MarkdownEditor {...defaultProps} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New content" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith("New content");
  });

  it("calls onModeChange when clicking tabs", () => {
    const { rerender } = render(<MarkdownEditor {...defaultProps} />);

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    fireEvent.click(previewTab);

    expect(mockOnModeChange).toHaveBeenCalledTimes(1);
    expect(mockOnModeChange).toHaveBeenCalledWith("preview");

    // Simulate re-render with new mode using rerender
    rerender(<MarkdownEditor {...defaultProps} mode="preview" />);

    const writeTab = screen.getByRole("tab", { name: "Write" });
    fireEvent.click(writeTab);

    expect(mockOnModeChange).toHaveBeenCalledTimes(2);
    expect(mockOnModeChange).toHaveBeenCalledWith("write");
  });

  describe("keyboard navigation", () => {
    it("handles Home key to switch to write mode", () => {
      render(<MarkdownEditor {...defaultProps} mode="preview" />);

      const tablist = screen.getByRole("tablist");
      fireEvent.keyDown(tablist, { key: "Home" });

      expect(mockOnModeChange).toHaveBeenCalledWith("write");
    });

    it("handles End key to switch to preview mode", () => {
      render(<MarkdownEditor {...defaultProps} />);

      const tablist = screen.getByRole("tablist");
      fireEvent.keyDown(tablist, { key: "End" });

      expect(mockOnModeChange).toHaveBeenCalledWith("preview");
    });

    it("handles ArrowRight key to toggle mode", () => {
      render(<MarkdownEditor {...defaultProps} />);

      const tablist = screen.getByRole("tablist");
      fireEvent.keyDown(tablist, { key: "ArrowRight" });

      expect(mockOnModeChange).toHaveBeenCalledWith("preview");
    });

    it("handles ArrowLeft key to toggle mode", () => {
      render(<MarkdownEditor {...defaultProps} mode="preview" />);

      const tablist = screen.getByRole("tablist");
      fireEvent.keyDown(tablist, { key: "ArrowLeft" });

      expect(mockOnModeChange).toHaveBeenCalledWith("write");
    });

    it("ignores other keys", () => {
      render(<MarkdownEditor {...defaultProps} />);

      const tablist = screen.getByRole("tablist");
      fireEvent.keyDown(tablist, { key: "Enter" });
      fireEvent.keyDown(tablist, { key: "Space" });

      expect(mockOnModeChange).not.toHaveBeenCalled();
    });
  });

  it("renders placeholder text when preview is empty", () => {
    render(<MarkdownEditor {...defaultProps} value="   " mode="preview" />);

    expect(screen.queryByTestId("mock-markdown-renderer")).not.toBeInTheDocument();
    expect(screen.getByText("プレビューする内容がありません")).toBeInTheDocument();
  });
});
