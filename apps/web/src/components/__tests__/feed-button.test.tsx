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

  it("copies the feed URL to the clipboard", async () => {
    render(<FeedButton url="https://api.example/feed.xml" />);

    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

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

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このブラウザではクリップボード機能を利用できません",
      );
    });
  });

  it("shows an error when clipboard.writeText throws", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("permission denied");
        }),
      },
    });

    render(<FeedButton url="https://api.example/feed.xml" />);
    fireEvent.click(screen.getByRole("button", { name: "📡 Feed" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "クリップボードへのコピーに失敗しました",
      );
    });
  });

  it("renders with a custom label", () => {
    render(<FeedButton url="https://api.example/feed.xml" label="Subscribe" />);

    expect(screen.getByRole("button", { name: "Subscribe" })).toBeInTheDocument();
  });

  it("renders with a custom className", () => {
    render(
      <FeedButton
        url="https://api.example/feed.xml"
        className="my-custom-class"
      />,
    );

    expect(screen.getByRole("button")).toHaveClass("my-custom-class");
  });
});