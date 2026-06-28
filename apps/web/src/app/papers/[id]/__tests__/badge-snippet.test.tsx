import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeSnippet } from "../badge-snippet";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/components/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ unoptimized: _unoptimized, ...props }: any) => <img {...props} />,
}));

describe("BadgeSnippet", () => {
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

  it("renders preview and all snippet formats", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="https://openshelf.example"
      />,
    );

    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("HTML")).toBeInTheDocument();
    expect(screen.getByText("shields.io")).toBeInTheDocument();
    expect(
      screen.getByAltText("OpenShelf badge preview for Paper Title"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("/badge/paper-1?style=default&label=OpenShelf"),
    );
    expect(screen.getAllByText(/\[!\[OpenShelf Badge\]/)).toHaveLength(2);
  });

  it("uses visible Copy text at the start of each accessible button name", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="https://openshelf.example"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Copy Markdown" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy HTML" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy shields.io" }),
    ).toBeInTheDocument();
  });

  it("copies selected snippet via clipboard", async () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="https://openshelf.example"
      />,
    );

    const markdownPanel = screen.getByText("Markdown").closest("div");
    expect(markdownPanel).not.toBeNull();
    fireEvent.click(
      markdownPanel!.querySelector("button") as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith("コピーしました");
    });
  });

  it("escapes title content in HTML snippet", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title={'My "Quoted" <Paper> & more'}
        siteBase="https://openshelf.example"
      />,
    );

    expect(
      screen.getByText((text) =>
        text.includes(
          'alt="OpenShelf badge for My &quot;Quoted&quot; &lt;Paper&gt; &amp; more"',
        ),
      ),
    ).toBeInTheDocument();
  });

  it("escapes malicious siteBase in HTML snippet to prevent XSS", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase='https://openshelf.example"><script>alert(1)</script>'
      />,
    );

    expect(
      screen.getByText(
        (text) =>
          text.includes('href="#"') ||
          text.includes('href="#/papers/paper-1"') ||
          text.includes(
            'href="https://openshelf.example&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;/papers/paper-1"',
          ),
      ),
    ).toBeInTheDocument();
  });

  it("replaces javascript: siteBase with # in HTML snippet to prevent protocol injection", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="javascript:alert(1)//"
      />,
    );

    expect(
      screen.getByText((text) => text.includes('href="#"')),
    ).toBeInTheDocument();
  });

  it("replaces dangerous data: URL with # in HTML snippet", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="data:text/html,<script>alert(1)</script>"
      />,
    );

    expect(
      screen.getByText((text) => text.includes('href="#"')),
    ).toBeInTheDocument();
  });

  it("replaces dangerous vbscript: URL with # in HTML snippet", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="vbscript:msgbox(1)"
      />,
    );

    expect(
      screen.getByText((text) => text.includes('href="#"')),
    ).toBeInTheDocument();
  });

  it("replaces dangerous case-variant JavaScript: with # in HTML snippet", () => {
    render(
      <BadgeSnippet
        paperId="paper-1"
        title="Paper Title"
        siteBase="JavaScript:alert(1)"
      />,
    );

    expect(
      screen.getByText((text) => text.includes('href="#"')),
    ).toBeInTheDocument();
  });
});
