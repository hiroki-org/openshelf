import { Page, expect } from "@playwright/test";

export async function createOrg(page: Page, { name, slug, description }: { name: string; slug: string; description?: string }): Promise<string> {
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
    expect(response.ok()).toBeTruthy();

    const data: any = await response.json();
    return data.org.slug;
}
