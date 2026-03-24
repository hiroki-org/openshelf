const fs = require('fs');
let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

if (code.includes('// const alertSpy')) {
  code = code.replace(/\s*\/\/\s*const\s*alertSpy\s*=\s*vi\.mocked\(window\.alert\);\s*/g, '\n');
  fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
  console.log('Removed comments.');
} else {
  console.log('No comments found.');
}
