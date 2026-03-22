import { Page } from "@playwright/test";
import path from "path";
import fs from "fs";

type PaperUploadResponse = {
    paper: {
        id: string;
    };
};

type UploadPaperOptions = {
    filePath?: string;
    mimeType?: string;
    fileType?: "paper" | "slides" | "poster" | "supplementary";
};

const DEFAULT_FILE_PATH = path.resolve(__dirname, "../fixtures/test-paper.pdf");

export async function uploadPublicPaper(
    page: Page,
    title: string,
    options?: UploadPaperOptions,
): Promise<string> {
    return uploadPaper(page, title, "public", undefined, options);
}

export async function uploadPrivatePaper(
    page: Page,
    title: string,
    options?: UploadPaperOptions,
): Promise<string> {
    return uploadPaper(page, title, "private", undefined, options);
}

export async function uploadOrgOnlyPaper(
    page: Page,
    title: string,
    orgId?: string,
    options?: UploadPaperOptions,
): Promise<string> {
    return uploadPaper(page, title, "org_only", orgId, options);
}

async function uploadPaper(
    page: Page,
    title: string,
    visibility: "public" | "private" | "org_only",
    orgId?: string,
    options?: UploadPaperOptions,
): Promise<string> {
    await page.goto("/upload");
    await page.getByLabel(/タイトル/).fill(title);
    await page.getByLabel("公開範囲").selectOption(visibility);

    // If org_only, select the organization
    if (visibility === "org_only") {
        const orgSelect = page.getByLabel("対象組織");
        if (orgId) {
            await orgSelect.waitFor({ state: "visible" });
            await orgSelect.selectOption(orgId);
        } else {
            // If no specific orgId provided, select the first available org
            // Wait for the dropdown to appear
            await orgSelect.waitFor({ state: "visible" });
            // Wait until at least one non-empty organization option is ready
            const orgOption = orgSelect.locator('option[value]:not([value=""])').first();
            await orgOption.waitFor({ state: "attached" });
            const value = await orgOption.getAttribute("value");
            if (value) {
                await orgSelect.selectOption(value);
            } else {
                throw new Error("No organizations available for org_only paper upload");
            }
        }
    }

    const resolvedPath = options?.filePath ?? DEFAULT_FILE_PATH;
    if (options?.mimeType) {
        await page.setInputFiles('input[type="file"]', {
            name: path.basename(resolvedPath),
            mimeType: options.mimeType,
            buffer: fs.readFileSync(resolvedPath),
        });
    } else {
        await page.setInputFiles('input[type="file"]', resolvedPath);
    }

    if (options?.fileType) {
        const fileTypeSelect = page.getByLabel("ファイル種別").first();
        await fileTypeSelect.selectOption(options.fileType);
    }

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
