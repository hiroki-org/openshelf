const fs = require('fs');

// 1. Move `handleApiAction` outside the component `OrgSettingsPage` to avoid redefining on every render and fix the issue where it's defined after a conditional return.
const pageFile = 'apps/web/src/app/orgs/[slug]/settings/page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf8');

if (pageCode.includes('const handleApiAction = async')) {
  // Extract handleApiAction
  const startIdx = pageCode.indexOf('  const handleApiAction = async');
  const endStr = '  };\n\n  // ── General handlers ──';
  const endIdx = pageCode.indexOf(endStr) + 4; // up to '  };'

  if (startIdx !== -1 && endIdx > startIdx) {
    const fnCode = pageCode.substring(startIdx, endIdx);

    // Remove from inside the component
    pageCode = pageCode.substring(0, startIdx) + pageCode.substring(endIdx);

    // Unindent the function body by 2 spaces for module scope
    const unindentedFnCode = fnCode.split('\n').map(line => line.startsWith('  ') ? line.substring(2) : line).join('\n');

    // Insert after imports, before types or component
    const insertIdx = pageCode.indexOf('type Org = {');
    pageCode = pageCode.substring(0, insertIdx) + unindentedFnCode + '\n\n' + pageCode.substring(insertIdx);
  }
}

fs.writeFileSync(pageFile, pageCode);


// 2. Remove unused `alertSpy` in `apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx`
const testFile = 'apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx';
let testCode = fs.readFileSync(testFile, 'utf8');

// In "handles delete failure and cancellation"
testCode = testCode.replace(
  'const alertSpy = vi.mocked(toast.error);\n    const originalMock',
  'const originalMock'
);

fs.writeFileSync(testFile, testCode);
