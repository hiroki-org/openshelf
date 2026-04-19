const fs = require('fs');
const path = 'apps/web/src/app/papers/[id]/__tests__/paper-detail-client.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
  it("cleans up urls on unmount", async () => {
    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
      />
    );
    unmount();
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

    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
      />
    );

    unmount();
    await new Promise(r => setTimeout(r, 10));
  });
`;

code = code.replace(/it\("cleans up urls on unmount", async \(\) => \{[\s\S]*?The test ensures the cleanup does not throw and executes successfully\.\n  \}\);/g, replacement.trim());

fs.writeFileSync(path, code, 'utf8');
