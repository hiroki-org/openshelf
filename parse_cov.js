const fs = require('fs');

const raw = fs.readFileSync('coverage.json', 'utf8');
// Extract the JSON portion from the output
const jsonMatch = raw.match(/\{"numTotalTestSuites".*\}/s);
if (!jsonMatch) {
  console.log('No JSON data found in coverage.json');
  process.exit(1);
}

const data = JSON.parse(jsonMatch[0]);

for (const [file, cov] of Object.entries(data.coverageMap || {})) {
  if (file.match(/(papers|collections|auth|orgs)\.ts$/)) {
    const missingLines = [];
    for (const [id, count] of Object.entries(cov.s || {})) {
      if (count === 0 && cov.statementMap && cov.statementMap[id]) {
        missingLines.push(cov.statementMap[id].start.line);
      }
    }
    const missingBranches = [];
    for (const [id, counts] of Object.entries(cov.b || {})) {
      if (counts.some(c => c === 0) && cov.branchMap && cov.branchMap[id]) {
        missingBranches.push(cov.branchMap[id].line);
      }
    }

    if (missingLines.length === 0 && missingBranches.length === 0) continue;

    const fileContent = fs.readFileSync(file, 'utf8').split('\n');
    console.log(`\n=== ${file.split('/').slice(-3).join('/')} ===`);
    console.log(`Uncovered Statements (lines): ${[...new Set(missingLines)].sort((a,b)=>a-b).join(', ')}`);
    console.log(`Uncovered Branches (lines): ${[...new Set(missingBranches)].sort((a,b)=>a-b).join(', ')}`);

    // Print the actual code lines for missing branches
    const allLines = [...new Set([...missingLines, ...missingBranches])].sort((a,b)=>a-b);
    for (const line of allLines.slice(0, 10)) { // limit to 10 to avoid huge output
      console.log(`Line ${line}: ${fileContent[line-1]?.trim()}`);
    }
    if (allLines.length > 10) console.log(`... and ${allLines.length - 10} more`);
  }
}
