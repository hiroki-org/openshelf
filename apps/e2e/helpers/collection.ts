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

    // The submit button stays disabled while slug availability is being checked.
    // Wait explicitly to avoid flaky clicks that never trigger a POST.
    const submitButton = page.getByRole("button", { name: "作成", exact: true });
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    const responsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/collections") && response.request().method() === "POST"
    );

    await submitButton.click();

    const response = await responsePromise;
    if (!response.ok()) {
        throw new Error(`createCollection failed: ${response.status()} ${await response.text()}`);
    }

    const data: any = await response.json();
    return data.collection.slug;
}
