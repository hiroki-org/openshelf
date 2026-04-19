const fs = require('fs');
const path = 'apps/web/src/app/papers/[id]/__tests__/paper-detail-client.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldTestStr = `
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
    );`;

const newTestStr = `
    const { unmount } = render(
      <PaperDetailClient
        paperId="test-id"
        siteBase="http://localhost"
      />
    );`;

code = code.replace(oldTestStr.trim(), newTestStr.trim());

fs.writeFileSync(path, code, 'utf8');
