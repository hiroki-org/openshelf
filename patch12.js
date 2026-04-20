const fs = require('fs');
const testFile = 'apps/api/src/routes/__tests__/csrf.test.ts';

let content = fs.readFileSync(testFile, 'utf8');

// Ah, wait. I added a test in `csrf.test.ts` during my first set of fixes that checks `Mocked environment error`.
// Let's modify it to expect `Error: Mocked environment error` as per the new format.

content = content.replace(
    'expect(consoleErrorMock).toHaveBeenCalledWith("CSRF check error: Mocked environment error");',
    'expect(consoleErrorMock).toHaveBeenCalledWith("CSRF check error: Error: Mocked environment error");'
);

fs.writeFileSync(testFile, content);
