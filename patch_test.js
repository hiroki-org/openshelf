const fs = require('fs');

const path = 'apps/api/src/routes/__tests__/users.test.ts';
let code = fs.readFileSync(path, 'utf8');

// I accidentally appended `it` blocks after the closing `});` of `describe("users routes", ...)`
// Let's move the `});` to the very end of the file.

const lastDescribeBraceIndex = code.indexOf('\n});\n', code.indexOf('GET /api/users/:id returns 404'));
if (lastDescribeBraceIndex > -1) {
  // Remove the middle `});`
  code = code.slice(0, lastDescribeBraceIndex) + '\n' + code.slice(lastDescribeBraceIndex + 5);
  // Add it back to the end
  code += '\n});\n';
  fs.writeFileSync(path, code);
  console.log("Fixed!");
} else {
  console.log("Not found where expected");
}
