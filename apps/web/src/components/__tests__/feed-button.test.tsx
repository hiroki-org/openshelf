import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedButton } from "../feed-button";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/components/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("FeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the feed URL and open link in the popover", () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

    expect(screen.getByRole("textbox", { name: "フィード URL" })).toHaveValue(
      "https://api.example/feed.xml",
    );
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute(
      "href",
      "https://api.example/feed.xml",
    );
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("renders custom label and className", () => {
    render(
      <FeedButton
        url="https://api.example/feed.xml"
        label="Feed URL を表示"
        className="custom-trigger"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Feed URL を表示" });
    expect(trigger).toHaveClass("custom-trigger");
  });

  it("moves focus into the dialog when it opens", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "フィード URL" })).toHaveFocus();
    });
  });

  it("closes the dialog when clicking outside with pointer events", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    const trigger = screen.getByRole("button", { name: "📡 Feed" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "フィード URL" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "フィード URL" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("traps focus inside the dialog and returns focus on escape", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    const trigger = screen.getByRole("button", { name: "📡 Feed" });
    fireEvent.click(trigger);

    const textbox = await screen.findByRole("textbox", { name: "フィード URL" });
    const link = screen.getByRole("link", { name: "開く" });

    textbox.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(textbox).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "フィード URL" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps focus trapped when tabbing from the dialog container", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

    const dialog = await screen.findByRole("dialog", { name: "フィード URL" });
    const textbox = screen.getByRole("textbox", { name: "フィード URL" });

    dialog.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(textbox).toHaveFocus();
  });

  it("copies the feed URL from the popover", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://api.example/feed.xml",
      );
      expect(toastSuccess).toHaveBeenCalledWith("コピーしました");
    });
  });

  it("shows an error when clipboard write fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("clipboard write failed");
        }),
      },
    });

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("クリップボードへのコピーに失敗しました");
    });
  });

  it("shows an error when clipboard.writeText is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: {} });

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このブラウザではクリップボード機能を利用できません",
      );
    });
  });

  it("shows an error when clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このブラウザではクリップボード機能を利用できません",
      );
    });
  });
});
