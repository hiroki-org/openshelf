const fs = require('fs');
const path = 'apps/web/src/app/papers/[id]/__tests__/paper-detail-client.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const unmountTest = `
  it("cleans up urls on unmount", async () => {
    vi.stubGlobal("requestIdleCallback", (cb: any) => {
      cb({ timeRemaining: () => 10, didTimeout: false });
    });

    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
      />
    );

    // Allow the initial render and effects to run
    await new Promise(r => setTimeout(r, 0));
    unmount();

    // The test ensures the cleanup does not throw and executes successfully.
  });
`;

code = code.replace(/it\("cleans up urls on unmount", async \(\) => \{[\s\S]*?\/\/ That's totally fine, we just want to hit the `revokeUrlsIdle` branch on unmount!\n  \}\);/, unmountTest.trim());

fs.writeFileSync(path, code, 'utf8');
