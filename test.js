const fs = require('fs');
let content = fs.readFileSync('apps/api/src/routes/users.ts', 'utf8');

content = content.replace(
    '// TODO: Add proper index for search or switch to full-text search engine\n',
    ''
);

content = content.replace(
    /like\(users\.name, `%\$\{q\}%`\),\n                    like\(users\.githubId, `%\$\{q\}%`\),/,
    'like(users.name, `%${q}%`),\n                    like(users.githubId, `%${q}%`),\n                    like(users.displayName, `%${q}%`),'
);

fs.writeFileSync('apps/api/src/routes/users.ts', content);

let schemaContent = fs.readFileSync('apps/api/src/db/schema.ts', 'utf8');
schemaContent = schemaContent.replace(
    '(t) => [uniqueIndex("users_github_id_idx").on(t.githubId)],',
    '(t) => [\n        uniqueIndex("users_github_id_idx").on(t.githubId),\n        index("users_name_idx").on(t.name),\n        index("users_display_name_idx").on(t.displayName),\n    ],'
);
fs.writeFileSync('apps/api/src/db/schema.ts', schemaContent);
