const fs = require('fs');
let content = fs.readFileSync('apps/web/src/components/__tests__/pdf-viewer.test.tsx', 'utf8');

// The feedback says we need to make `mockDocument` a stateful component and only render `props.error`
// when an error occurs, and add an assertion to verify "ダウンロードする" is not present before the error.

const statefulMock = `import { useState } from "react";\n\nconst mockDocument = vi.fn((props: MockDocumentProps) => {
  const [hasError, setHasError] = useState(false);
  return (
    <div data-testid="mock-document">
      <button
        data-testid="mock-load-success"
        onClick={() => props.onLoadSuccess?.({ numPages: 5 })}
      >Load Success</button>
      <button
        data-testid="mock-load-error"
        onClick={() => {
          setHasError(true);
          props.onLoadError?.(new Error("Test error"));
        }}
      >Load Error</button>
      {hasError && <div data-testid="error-state">{props.error}</div>}
      {props.children}
    </div>
  );
});`;

content = content.replace(
  /const mockDocument = vi\.fn\(\(props: MockDocumentProps\) => \([\s\S]*?\}\s*<\/div>\n\)\);/,
  statefulMock
);

content = content.replace(
  'it("handles document load error with fallback", () => {',
  `it("handles document load error with fallback", () => {
    const onFallback = vi.fn();
    const { getByTestId, getByText, queryByText } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" onDownloadFallback={onFallback} />);

    expect(queryByText("ダウンロードする")).toBeNull();

    fireEvent.click(getByTestId("mock-load-error"));

    const downloadBtn = getByText("ダウンロードする");
    fireEvent.click(downloadBtn);

    expect(onFallback).toHaveBeenCalled();
  });`
);

// We need to remove the duplicate it("handles document load error with fallback")
// Let's replace the whole file content to be safe.
