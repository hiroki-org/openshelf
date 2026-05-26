import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    expect(
      screen.getByRole("link", { name: "フィードを新しいタブで開く" }),
    ).toHaveAttribute("href", "https://api.example/feed.xml");
    expect(
      screen.getByRole("link", { name: "フィードを新しいタブで開く" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("moves focus into the dialog when it opens", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "フィード URL" }),
      ).toHaveFocus();
    });
  });

  it("closes the dialog when clicking outside with pointer events", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    expect(
      screen.getByRole("dialog", { name: "フィード URL" }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "フィード URL" }),
      ).not.toBeInTheDocument();
    });
  });

  it("traps focus inside the dialog and returns focus on escape", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    const trigger = screen.getByRole("button", { name: "📡 Feed" });
    fireEvent.click(trigger);

    const textbox = await screen.findByRole("textbox", {
      name: "フィード URL",
    });
    const link = screen.getByRole("link", {
      name: "フィードを新しいタブで開く",
    });

    textbox.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(textbox).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "フィード URL" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("copies the feed URL from the popover", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "フィードURLをクリップボードにコピー",
      }),
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://api.example/feed.xml",
      );
      expect(toastSuccess).toHaveBeenCalledWith("コピーしました");
    });
  });

  it("shows an error when clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "フィードURLをクリップボードにコピー",
      }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このブラウザではクリップボード機能を利用できません",
      );
    });
  });

  it("shows an error when clipboard write fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "フィードURLをクリップボードにコピー",
      }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "クリップボードへのコピーに失敗しました",
      );
    });
  });

  it("supports custom label and class name", () => {
    render(
      <FeedButton
        url="https://api.example/feed.xml"
        label="Custom feed"
        className="my-feed-button"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Custom feed" });
    expect(trigger).toHaveClass("my-feed-button");
  });

  it("toggles the dialog closed when trigger is clicked twice", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    const trigger = screen.getByRole("button", { name: "📡 Feed" });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "フィード URL" }),
    ).toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "フィード URL" }),
      ).not.toBeInTheDocument();
    });
  });

  it("updates aria-expanded based on popover state", () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    const trigger = screen.getByRole("button", { name: "📡 Feed" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the default trigger style class", () => {
    render(<FeedButton url="https://api.example/feed.xml" />);
    expect(screen.getByRole("button", { name: "📡 Feed" })).toHaveClass(
      "rounded-md",
    );
  });

  it("supports a custom ariaLabel prop for list contexts", () => {
    render(
      <FeedButton
        url="https://api.example/feed.xml"
        ariaLabel="論文AのフィードURLを表示"
      />,
    );
    expect(
      screen.getByRole("button", { name: "論文AのフィードURLを表示" }),
    ).toBeInTheDocument();
  });
});
