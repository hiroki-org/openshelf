const fs = require('fs');

const filePath = 'apps/api/src/routes/__tests__/collections.test.ts';
let code = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Remove double blank line
code = code.replace(/\n\n\n    it\("PATCH \/api\/collections\/:id rejects update when slug is already in use",/g, '\n\n    it("PATCH /api/collections/:id rejects update when slug is already in use",');

// Fix 2: Add validation of 'set' call arguments
const setMockTarget = `        mockDb.update = vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(async () => {
                    throw new Error("UNIQUE constraint failed: collections.slug");
                }),
            })),
        }));`;

const setMockReplacement = `        const setValues = vi.fn(() => ({
            where: vi.fn(async () => {
                throw new Error("UNIQUE constraint failed: collections.slug");
            }),
        }));
        mockDb.update = vi.fn(() => ({
            set: setValues,
        }));`;
code = code.replace(setMockTarget, setMockReplacement);

const expectStatusTarget = `        expect(res.status).toBe(409);`;
const expectStatusReplacement = `        expect(res.status).toBe(409);
        expect(setValues).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "existing-slug",
            }),
        );`;
code = code.replace(expectStatusTarget, expectStatusReplacement);

// Fix 3: Add new test case for non-unique constraint errors propagating as 500
const insertAfterTarget = `        expect(((await res.json()) as any).error).toBe("slug already in use");
    });`;

const newTestCase = `

    it("PATCH /api/collections/:id rethrows non-unique constraint errors", async () => {
        const token = await createTestJWT({ sub: "user-1" });
        queueSelectResponses([
            {
                getResult: {
                    id: "col-1",
                    ownerType: "user",
                    ownerId: "user-1",
                    visibility: "private",
                },
            },
        ]);

        mockDb.update = vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(async () => {
                    throw new Error("FOREIGN KEY constraint failed");
                }),
            })),
        }));

        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request(
            "http://localhost/api/collections/col-1",
            {
                method: "PATCH",
                headers: {
                    Authorization: \`Bearer \${token}\`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ slug: "existing-slug" }),
            },
            env as any,
        );

        expect(res.status).toBe(500);
    });`;
code = code.replace(insertAfterTarget, insertAfterTarget + newTestCase);

fs.writeFileSync(filePath, code);

const apiFilePath = 'apps/api/src/routes/collections.ts';
let apiCode = fs.readFileSync(apiFilePath, 'utf-8');

// Fix 4: Tighten isUniqueConstraintError regex
const uniqueErrorTarget = `function isUniqueConstraintError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes("UNIQUE") || message.includes("unique") || message.includes("constraint");
}`;

const uniqueErrorReplacement = `function isUniqueConstraintError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /unique\\s+constraint/i.test(message);
}`;
apiCode = apiCode.replace(uniqueErrorTarget, uniqueErrorReplacement);

fs.writeFileSync(apiFilePath, apiCode);

console.log("Patches applied successfully.");
