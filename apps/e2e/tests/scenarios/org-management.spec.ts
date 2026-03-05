import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';
import { createOrg } from '../../helpers/org';
import { generateTestOrgName, generateTestPaperTitle } from '../../helpers/fixtures';

test.describe('Org Management', () => {
    test('org作成、設定、論文紐づけフロー', async ({ page }) => {
        await loginAsTestUser(page);

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
        await expect(page.locator('select').first()).toHaveValue('admin');

        // 論文アップロード
        const paperTitle = generateTestPaperTitle();
        const paperId = await uploadPublicPaper(page, paperTitle);

        // orgに論文を紐づけ
        await page.goto(`/orgs/${orgSlug}/settings`);
        await page.getByRole('button', { name: '論文' }).click();
        await page.getByPlaceholder(/論文タイトルで検索/).fill(paperTitle);
        await page.getByRole('button', { name: '追加' }).first().click();

        // org ページの論文一覧に反映されること
        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('link', { name: paperTitle })).toBeVisible();
    });
});
