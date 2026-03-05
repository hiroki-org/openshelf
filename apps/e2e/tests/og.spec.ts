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

function getMetaContent(html: string, attrName: "property" | "name", attrValue: string): string | null {
    const escapedValue = attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
        `<meta[^>]*${attrName}=["']${escapedValue}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${escapedValue}["'][^>]*>`,
        "i",
    );
    const match = html.match(pattern);
    return match?.[1] ?? match?.[2] ?? null;
}

test.describe("OG metadata", () => {
    test("論文ページにOGメタタグが含まれること", async ({ page }) => {
        await loginAsTestUser(page);
        const title = `OG Test Paper - ${randomUUID()}`;
        const paperId = await uploadPublicPaper(page, title);

        const res = await page.request.get(`/papers/${paperId}`);
        expect(res.ok()).toBeTruthy();

        const html = await res.text();
        const ogTitle = getMetaContent(html, "property", "og:title");
        const ogDescription = getMetaContent(html, "property", "og:description");
        const ogImage = getMetaContent(html, "property", "og:image");
        const twitterCard = getMetaContent(html, "name", "twitter:card");

        expect(ogTitle).toContain(title);
        expect(ogDescription).toContain("OpenShelf");
        expect(ogImage).toContain("/api/og?");
        expect(ogImage).toContain("type=paper");
        expect(twitterCard).toBe("summary_large_image");
    });

    test("/api/og が PNG を返すこと", async ({ page }) => {
        const res = await page.request.get("/api/og?type=paper&title=Test");
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toContain("image/png");
    });
});
