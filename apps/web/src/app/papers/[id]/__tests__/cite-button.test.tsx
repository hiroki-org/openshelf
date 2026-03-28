import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CiteButton } from "../cite-button";
import { apiFetch } from "@/lib/api";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("CiteButton", () => {
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

  it("copies bibtex citation via dropdown", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          format: "bibtex",
          citation: "@inproceedings{mukai2026boundary,...}",
          key: "mukai2026boundary",
        }),
        { status: 200 },
      ),
    );

    render(<CiteButton paperId="paper-1" />);
    fireEvent.click(screen.getByRole("button", { name: /📋 Cite/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "BibTeX" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/papers/paper-1/cite?format=bibtex");
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "@inproceedings{mukai2026boundary,...}",
      );
      expect(toastSuccess).toHaveBeenCalledWith("Copied!");
    });
  });

  it("shows error toast when API request fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("error", { status: 500 }));

    render(<CiteButton paperId="paper-1" />);
    fireEvent.click(screen.getByRole("button", { name: /📋 Cite/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Plain Text" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("引用の生成に失敗しました");
    });
  });
});
