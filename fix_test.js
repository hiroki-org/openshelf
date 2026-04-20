const fs = require('fs');
const path = 'apps/web/src/app/papers/[id]/__tests__/paper-detail-client.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
  it("cleans up urls on unmount", async () => {
    vi.stubGlobal("requestIdleCallback", (cb: any) => {
      cb({ timeRemaining: () => 10, didTimeout: false });
    });

    const mockPaperObj = {
      id: "test-id",
      title: "Test Paper",
      publishedAt: "2024-01-01",
      updatedAt: "2024-01-01",
      visibility: "public",
      authors: [],
    };

    // We pass an image file so that URL.revokeObjectURL actually gets triggered!
    // But since fetch is not mocked here to return a blob, it might throw or not populate.
    // However, if we just mock URL.createObjectURL directly before render, we can control it.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["test"])),
    }));

    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
        paper={mockPaperObj as any}
        isAuthor={false}
        currentUser={null}
        pdfFile={{ id: "pdf-1", filename: "paper.pdf" } as any}
        imageFiles={[{ id: "img-1", filename: "image.png" } as any]}
      />
    );

    // Wait until URL.createObjectURL has been called inside loadImages()
    await vi.waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();

    // Now that createdUrls has at least 1 item, the while loop in revokeUrlsIdle will execute
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("cleans up urls with setTimeout fallback if requestIdleCallback is missing", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("requestIdleCallback", undefined);

    const UrlMock = Object.assign(
      class extends URL {},
      {
        createObjectURL: vi.fn(() => \`blob:mock-fallback\`),
        revokeObjectURL: vi.fn(),
      },
    ) as typeof URL;
    vi.stubGlobal("URL", UrlMock);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["test"])),
    }));

    const mockPaperObj = {
      id: "test-id",
      title: "Test Paper",
      publishedAt: "2024-01-01",
      updatedAt: "2024-01-01",
      visibility: "public",
      authors: [],
    };

    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
        paper={mockPaperObj as any}
        isAuthor={false}
        currentUser={null}
        pdfFile={{ id: "pdf-1", filename: "paper.pdf" } as any}
        imageFiles={[{ id: "img-1", filename: "image.png" } as any]}
      />
    );

    await vi.waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
    }, { timeout: 2000 });

    unmount();

    // Allow the setTimeout(0) to execute
    await new Promise(r => setTimeout(r, 10));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
`;

code = code.replace(/it\("cleans up urls on unmount", async \(\) => \{[\s\S]*?expect\(URL\.revokeObjectURL\)\.toHaveBeenCalled\(\);\n  \}\);/g, replacement.trim());

fs.writeFileSync(path, code, 'utf8');
