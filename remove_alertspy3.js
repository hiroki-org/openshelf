const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

const regex = /    \/\/ const alertSpy = vi\.mocked\(window\.alert\);\n/g;

if (code.match(regex)) {
  code = code.replace(regex, '');
  fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
  console.log("Success");
} else {
  console.log("Regex didn't match");
}
