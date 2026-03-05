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

    const data = await response.json();
    return data.paper.id as string;
}

test.describe("OG metadata", () => {
    test("論文ページにOGメタタグが含まれること", async ({ page }) => {
        await loginAsTestUser(page);
        const title = `OG Test Paper - ${randomUUID()}`;
        const paperId = await uploadPublicPaper(page, title);

        const res = await page.request.get(`/papers/${paperId}`);
        expect(res.ok()).toBeTruthy();

        const html = await res.text();
        expect(html).toContain('property="og:title"');
        expect(html).toContain('property="og:description"');
        expect(html).toContain('property="og:image"');
        expect(html).toContain('name="twitter:card"');
    });

    test("/api/og が PNG を返すこと", async ({ page }) => {
        const res = await page.request.get("/api/og?type=paper&title=Test");
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toContain("image/png");
    });
});
