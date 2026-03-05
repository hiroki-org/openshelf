import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser } from "../helpers/auth";
import path from "path";
import { randomUUID } from "crypto";

async function uploadPublicPaper(page: Page, title: string): Promise<string> {
    await page.goto("/upload");
    await page.getByLabel(/タイトル/).fill(title);
    await page.getByLabel("公開範囲").selectOption("public");
    await page.setInputFiles(
        'input[type="file"]',
        path.resolve(__dirname, "../fixtures/test-paper.pdf"),
    );

    const uploadResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes("/api/papers") &&
            response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "アップロード", exact: true }).click();
    const response = await uploadResponsePromise;
    expect(response.ok()).toBeTruthy();

    const data: unknown = await response.json();
    if (
        !data ||
        typeof data !== "object" ||
        !("paper" in data) ||
        !(data as { paper?: unknown }).paper ||
        typeof (data as { paper: { id?: unknown } }).paper.id !== "string"
    ) {
        throw new Error("Unexpected response shape: missing paper.id");
    }
    return (data as { paper: { id: string } }).paper.id;
}

test.describe("OG metadata", () => {
    test("論文ページにOGメタタグが含まれること", async ({ page }) => {
        await loginAsTestUser(page);
        const title = `OG Test Paper - ${randomUUID()}`;
        const paperId = await uploadPublicPaper(page, title);

        await page.goto(`/papers/${paperId}`);

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
        const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
        const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
        const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");

        expect(ogTitle).toContain(title);
        expect(ogDescription).toContain("OpenShelf");
        expect(ogImage).toContain("/api/og?");
        expect(ogImage).toContain("type=paper");
        expect(twitterCard).toBe("summary_large_image");
    });

    test("/api/og が各typeで PNG を返すこと", async ({ page }) => {
        const cases = [
            { type: "paper", title: "Test Paper" },
            { type: "org", title: "Test Org" },
            { type: "collection", title: "Test Collection" },
        ] as const;

        for (const testCase of cases) {
            const res = await page.request.get(
                `/api/og?type=${testCase.type}&title=${encodeURIComponent(testCase.title)}`,
            );
            expect(res.status()).toBe(200);
            expect(res.headers()["content-type"]).toContain("image/png");
        }
    });
});
