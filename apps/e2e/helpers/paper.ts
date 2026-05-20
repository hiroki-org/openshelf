import { Page } from "@playwright/test";
import path from "path";

type PaperUploadResponse = {
    paper: {
        id: string;
    };
};

export async function uploadPublicPaper(page: Page, title: string): Promise<string> {
    return uploadPaper(page, title, "public");
}

export async function uploadPrivatePaper(page: Page, title: string): Promise<string> {
    return uploadPaper(page, title, "private");
}

async function uploadPaper(page: Page, title: string, visibility: "public" | "private"): Promise<string> {
    await page.goto("/upload");
    await page.getByLabel(/タイトル/).fill(title);
    await page.getByLabel("公開範囲").selectOption(visibility);
    await page.setInputFiles(
        'input[type="file"]',
        path.resolve(__dirname, "../fixtures/test-paper.pdf"),
    );

    const uploadResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes("/api/papers") &&
            response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "論文をアップロードする" }).click();
    const response = await uploadResponsePromise;
    if (!response.ok()) {
        throw new Error(`uploadPaper failed: ${response.status()} ${await response.text()}`);
    }

    const data = await response.json() as PaperUploadResponse;
    if (!data?.paper?.id) {
        throw new Error(`Invalid paper upload response: ${JSON.stringify(data)}`);
    }
    return data.paper.id;
}
