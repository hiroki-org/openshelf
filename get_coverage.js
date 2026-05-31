const fs = require('fs');

const data = JSON.parse(fs.readFileSync('coverage/coverage-final.json', 'utf8'));

const printCoverage = (pathPattern) => {
    for (const key in data) {
        if (key.includes(pathPattern)) {
            const fileData = data[key];
            const statementCount = Object.keys(fileData.statementMap).length;
            const executedStatements = Object.values(fileData.s).filter(count => count > 0).length;
            const branchCount = Object.keys(fileData.branchMap).length;
            const executedBranches = Object.values(fileData.b).reduce((acc, curr) => acc + curr.filter(count => count > 0).length, 0);
            const totalBranches = Object.values(fileData.branchMap).reduce((acc, curr) => acc + curr.locations.length, 0);

            console.log(`File: ${key}`);
            console.log(`Statements: ${executedStatements}/${statementCount} (${statementCount === 0 ? 100 : (executedStatements / statementCount * 100).toFixed(2)}%)`);
            console.log(`Branches: ${executedBranches}/${totalBranches} (${totalBranches === 0 ? 100 : (executedBranches / totalBranches * 100).toFixed(2)}%)`);
        }
    }
}

printCoverage('user-page-client.tsx');
printCoverage('user-collection-page-client.tsx');
printCoverage('org-page-client.tsx');
printCoverage('settings/page.tsx');
