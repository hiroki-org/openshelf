import { Page } from "@playwright/test";

export async function createOrg(page: Page, { name, slug, description }: { name: string; slug: string; description?: string }): Promise<{ id: string; slug: string }> {
    await page.goto("/orgs/new");
    await page.locator('#org-name').fill(name);
    await page.locator('#org-slug').fill(slug);
    if (description) {
        await page.locator('#org-description').fill(description);
    }

    const responsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/orgs") && response.request().method() === "POST"
    );

    await page.getByRole("button", { name: "作成", exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
        throw new Error(`createOrg failed: ${response.status()} ${await response.text()}`);
    }

    const data: any = await response.json();
    return { id: data.org.id, slug: data.org.slug };
}
