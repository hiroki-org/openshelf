import { Page, expect } from "@playwright/test";

export async function createCollection(page: Page, owner: { type: "user" } | { type: "org"; orgSlug: string }, { name, slug, visibility }: { name: string; slug: string; visibility: string }): Promise<string> {
    await page.goto("/collections/new");

    if (owner.type === "org") {
        await page.getByLabel("org", { exact: true }).check();
        await page.getByLabel("org slug", { exact: true }).fill(owner.orgSlug);
    } else {
        await page.getByLabel("user", { exact: true }).check();
    }

    await page.getByLabel("name", { exact: true }).fill(name);
    await page.getByLabel("slug", { exact: true }).fill(slug);

    await page.getByLabel("visibility", { exact: true }).selectOption(visibility);

    const responsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/collections") && response.request().method() === "POST"
    );

    await page.getByRole("button", { name: "作成", exact: true }).click();

    const response = await responsePromise;
    if (!response.ok()) {
        throw new Error(`createCollection failed: ${response.status()} ${await response.text()}`);
    }

    const data: any = await response.json();
    return data.collection.slug;
}
