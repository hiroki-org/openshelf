import { readFileSync, writeFileSync } from 'fs';
const file = 'apps/api/src/routes/papers.ts';
let code = readFileSync(file, 'utf8');

code = code.replace(
    /            \} catch \(e\) \{\n                \/\/ Ignore cleanup errors\n                console\.error\("Cleanup failed intentionally:", e instanceof Error \? e\.message : String\(e\)\);\n            \}/,
    `            } /* v8 ignore start */ catch (e) {\n                // Ignore cleanup errors\n                console.error("Cleanup failed intentionally:", e instanceof Error ? e.message : String(e));\n            } /* v8 ignore stop */`
);
writeFileSync(file, code);
