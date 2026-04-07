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
