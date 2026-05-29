import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';
import { createOrg } from '../../helpers/org';
import { generateTestOrgName, generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('Org Management', () => {
    test('org作成、設定、論文紐づけフロー', async ({ page }) => {
        const user = await loginAsTestUser(page);

        // Org作成
        const orgName = generateTestOrgName();
        const orgSlug = orgName.toLowerCase().replace(/_/g, '-');
        await createOrg(page, { name: orgName, slug: orgSlug, description: 'Test Org Description' });

        // /orgs/:slug に遷移しているか、遷移させる
        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('heading', { name: orgName })).toBeVisible();
        await expect(page.getByText('Test Org Description')).toBeVisible();

        // オーナーとして表示されることを確認（設定ページ等）
        await page.goto(`/orgs/${orgSlug}/settings`);
        await page.getByRole('button', { name: 'メンバー' }).click();
        const memberRow = page.locator('li', { hasText: user.name }).first();
        await expect(memberRow.locator('select')).toHaveValue('admin');

        // 論文アップロード
        const paperTitle = generateTestPaperTitle();
        await uploadPublicPaper(page, paperTitle);

        // orgに論文を紐づけ
        await page.goto(`/orgs/${orgSlug}/settings`);
        await page.getByRole('button', { name: '成果物' }).click();
        await page.getByPlaceholder(/成果物タイトルで検索/).fill(paperTitle);
        const resultRow = page.locator('li', { hasText: paperTitle }).first();
        await resultRow.getByRole('button', { name: '追加' }).click();

        // org ページの論文一覧に反映されること
        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('link', { name: paperTitle })).toBeVisible();
    });
});
