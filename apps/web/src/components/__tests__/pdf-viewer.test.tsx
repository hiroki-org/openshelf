import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "../pdf-viewer";

type DocumentOptions = {
  cMapUrl?: string;
  cMapPacked?: boolean;
  standardFontDataUrl?: string;
};

type MockDocumentProps = {
  children?: ReactNode;
  file?: string;
  options?: DocumentOptions;
};

const mockDocument = vi.fn((props: MockDocumentProps) => (
  <div data-testid="mock-document">{props.children}</div>
));

const mockPage = vi.fn(() => <div data-testid="mock-page" />);

vi.mock("react-pdf", () => {
  const workerOptions = { workerSrc: "" };

  return {
    pdfjs: {
      version: "4.8.69",
      GlobalWorkerOptions: workerOptions,
    },
    Document: (props: MockDocumentProps) => mockDocument(props),
    Page: () => mockPage(),
  };
});

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    class MockResizeObserver {
      observe() {}
      disconnect() {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
  });

  it("passes multilingual font options to react-pdf Document", () => {
    render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    expect(mockDocument).toHaveBeenCalledTimes(1);
    const [props] = mockDocument.mock.calls[0] as [MockDocumentProps];

    expect(props.file).toBe("https://example.com/paper.pdf");
    expect(props.options).toMatchObject({
      cMapPacked: true,
      cMapUrl: expect.stringContaining("/cmaps/"),
      standardFontDataUrl: expect.stringContaining("/standard_fonts/"),
    });
  });
});
