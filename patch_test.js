const fs = require('fs');
const path = 'apps/web/src/app/papers/[id]/__tests__/paper-detail-client.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const setupCode = `    vi.stubGlobal("requestIdleCallback", (cb: any) => {
      // Execute synchronously
      cb({ timeRemaining: () => 10, didTimeout: false });
    });`;

code = code.replace(/vi\.stubGlobal\("URL", UrlMock\);/g, 'vi.stubGlobal("URL", UrlMock);\n' + setupCode);

const unmountTest = `
  it("cleans up urls on unmount", async () => {
    const mockPaperObj = {
      id: "test-id",
      title: "Test Paper",
      publishedAt: "2024-01-01",
      updatedAt: "2024-01-01",
      authors: [],
    };
    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
        paper={mockPaperObj as any}
        isAuthor={false}
        currentUser={null}
        pdfFile={{ id: "pdf-1", filename: "paper.pdf" }}
        imageFiles={[{ id: "img-1", filename: "image.png" }]}
      />
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
`;

code = code.replace(/it\("renders author controls/, unmountTest.trim() + '\n\n  it("renders author controls');

fs.writeFileSync(path, code, 'utf8');
