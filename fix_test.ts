import * as fs from 'fs';

let content = fs.readFileSync('apps/api/src/routes/__tests__/papers.test.ts', 'utf8');

const search = `    it("POST /api/papers creates paper with org_only visibility", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();`;

const replace = `    it("POST /api/papers creates paper with org_only visibility", async () => {
        const token = await createTestJWT({ sub: "user-1", githubId: "123", name: "Uploader" });
        const app = await createTestApp();
        const env = createTestEnv();

        mockDb.select = vi.fn(() => makeQuery({ getResult: { orgId: "org-1" } }));`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync('apps/api/src/routes/__tests__/papers.test.ts', content, 'utf8');
    console.log("Updated test file successfully.");
} else {
    console.log("Could not find search string in file.");
}
