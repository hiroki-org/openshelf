const fs = require('fs');

const path = 'apps/web/src/app/layout.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'import { Analytics } from "@vercel/analytics/next";\n',
  'import { Analytics } from "@vercel/analytics/next";\nimport { SpeedInsights } from "@vercel/speed-insights/next";\n'
);

content = content.replace(
  '<Analytics />\n',
  '<Analytics />\n        <SpeedInsights />\n'
);

fs.writeFileSync(path, content, 'utf8');
