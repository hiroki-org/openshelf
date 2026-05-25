import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

afterEach(() => {
  cleanup();
});

describe("MarkdownRenderer", () => {
  it("renders plain text correctly", () => {
    render(<MarkdownRenderer markdown="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("applies className prop to container", () => {
    const { container } = render(
      <MarkdownRenderer markdown="Text" className="custom-class" />,
    );
    expect(container.firstElementChild).toHaveClass("custom-class");
  });

  it("renders headers correctly", () => {
    render(<MarkdownRenderer markdown="# Header 1" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Header 1" });
    expect(heading).toBeInTheDocument();
  });

  it("renders custom anchors with target=_blank and rel=noopener noreferrer", () => {
    render(<MarkdownRenderer markdown="[Link](https://example.com)" />);
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("text-blue-600");
  });

  it("renders custom images with lazy loading", () => {
    render(
      <MarkdownRenderer markdown="![Alt text](https://example.com/image.png)" />,
    );
    const img = screen.getByRole("img", { name: "Alt text" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/image.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "Alt text");
    expect(img).toHaveClass("max-w-full rounded-md");
  });

  it("handles image without src properly", () => {
    render(<MarkdownRenderer markdown="![Alt text]()" />);
    const img = screen.getByRole("img", { name: "Alt text" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Alt text");
  });

  it("handles image without alt text properly", () => {
    const { container } = render(<MarkdownRenderer markdown="![](https://example.com/image.png)" />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/image.png");
    expect(img).toHaveAttribute("alt", "");
  });

  it("renders inline code correctly", () => {
    render(<MarkdownRenderer markdown="Here is some `inline code`" />);
    const code = screen.getByText("inline code");
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveClass("rounded bg-gray-100");
  });

  it("renders code blocks with pre correctly", () => {
    const markdown = "```javascript\nconst x = 1;\n```";
    const { container } = render(<MarkdownRenderer markdown={markdown} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveClass(
      "overflow-x-auto rounded-md bg-gray-950 p-3 text-sm text-gray-100",
    );
    const code = container.querySelector("code");
    expect(code).toBeInTheDocument();
    expect(code).toHaveClass("language-javascript");
    expect(
      container.querySelector('span[class^="hljs"], span[class*=" hljs"]'),
    ).toBeInTheDocument();
  });

  it("supports GitHub Flavored Markdown (tables)", () => {
    const tableMarkdown = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;
    render(<MarkdownRenderer markdown={tableMarkdown} />);

    // Check if table renders with custom classes
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass("min-w-full border-collapse");

    // Check if headers render
    const header1 = screen.getByRole("columnheader", { name: "Header 1" });
    expect(header1).toBeInTheDocument();
    expect(header1).toHaveClass("border border-gray-300");

    // Check if cells render
    const cell1 = screen.getByRole("cell", { name: "Cell 1" });
    expect(cell1).toBeInTheDocument();
    expect(cell1).toHaveClass("border border-gray-300");
  });

  it("sanitizes unsafe HTML elements and scripts", () => {
    const unsafeMarkdown = `
# Title
<script>alert('xss')</script>
<iframe src="javascript:alert('xss')"></iframe>
[Safe link](javascript:alert('xss'))
<a href="javascript:alert('xss')">Unsafe anchor</a>
    `;
    const { container } = render(
      <MarkdownRenderer markdown={unsafeMarkdown} />,
    );

    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();

    // script should be stripped
    expect(container.querySelector("script")).not.toBeInTheDocument();

    // iframe should be stripped
    expect(container.querySelector("iframe")).not.toBeInTheDocument();

    // unsafe link should have href removed or sanitized to empty string or #
    const link = screen.queryByRole("link", { name: "Safe link" });
    expect(link).toBeNull();

    const unsafeAnchorText = screen.queryByText("Unsafe anchor");
    if (unsafeAnchorText) {
      const anchor = unsafeAnchorText.closest("a");
      expect(anchor).not.toHaveAttribute("href");
    }
  });
});
