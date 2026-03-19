import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper, uploadOrgOnlyPaper } from '../../helpers/paper';
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
        const paperId = await uploadPublicPaper(page, paperTitle);

        // orgに論文を紐づけ
        await page.goto(`/orgs/${orgSlug}/settings`);
        await page.getByRole('button', { name: '論文' }).click();
        await page.getByPlaceholder(/論文タイトルで検索/).fill(paperTitle);
        const resultRow = page.locator('li', { hasText: paperTitle }).first();
        await resultRow.getByRole('button', { name: '追加' }).click();

        // org ページの論文一覧に反映されること
        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('link', { name: paperTitle })).toBeVisible();
    });

    test('org_only公開範囲で論文をアップロードし、組織メンバーのみがアクセス可能', async ({ page }) => {
        await loginAsTestUser(page);

        // Org作成
        const orgName = generateTestOrgName();
        const orgSlug = orgName.toLowerCase().replace(/_/g, '-');
        await createOrg(page, { name: orgName, slug: orgSlug });

        // org_only論文をアップロード
        const orgOnlyTitle = generateTestPaperTitle();
        const orgOnlyPaperId = await uploadOrgOnlyPaper(page, orgOnlyTitle);

        // 作成者が論文を見られることを確認
        await page.goto(`/papers/${orgOnlyPaperId}`);
        await expect(page.getByRole('heading', { name: orgOnlyTitle })).toBeVisible();
        await expect(page.getByText('組織内')).toBeVisible();

        // 別ユーザー（非メンバー）がアクセスできないことを確認
        await loginAsTestUser(page, { name: 'Other User' });
        await page.goto(`/papers/${orgOnlyPaperId}`);
        await expect(page.getByText('この論文を閲覧する権限がありません')).toBeVisible();
    });

    test('アップロードページで公開範囲を変更すると、組織選択ドロップダウンが表示/非表示になる', async ({ page }) => {
        await loginAsTestUser(page);

        // Org作成
        const orgName = generateTestOrgName();
        const orgSlug = orgName.toLowerCase().replace(/_/g, '-');
        await createOrg(page, { name: orgName, slug: orgSlug });

        // アップロードページへ
        await page.goto('/upload');

        // 最初は公開に設定されているので、組織選択は非表示
        await expect(page.getByLabel('対象組織')).not.toBeVisible();

        // 公開範囲をorg_onlyに変更
        await page.getByLabel('公開範囲').selectOption('org_only');

        // 組織選択が表示される
        await expect(page.getByLabel('対象組織')).toBeVisible();

        // 非公開に戻す
        await page.getByLabel('公開範囲').selectOption('private');

        // 組織選択が非表示になる
        await expect(page.getByLabel('対象組織')).not.toBeVisible();
    });

    test('org_onlyで論文アップロードする際、組織未選択でサブミットするとエラーが表示される', async ({ page }) => {
        await loginAsTestUser(page);

        // Org作成
        const orgName = generateTestOrgName();
        const orgSlug = orgName.toLowerCase().replace(/_/g, '-');
        await createOrg(page, { name: orgName, slug: orgSlug });

        // アップロードページへ
        await page.goto('/upload');

        const paperTitle = generateTestPaperTitle();
        await page.getByLabel(/タイトル/).fill(paperTitle);
        await page.getByLabel('公開範囲').selectOption('org_only');

        // ファイルを選択
        await page.setInputFiles(
            'input[type="file"]',
            { name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') },
        );

        // 組織未選択のまま送信を試みる
        await page.getByRole('button', { name: '論文をアップロードする' }).click();

        // エラーメッセージが表示される
        const orgSelectionError = page.locator('div[class*="border-red-200"][class*="text-red-700"]', {
            hasText: '組織を選択してください',
        });
        await expect(orgSelectionError).toBeVisible();
    });

    test('org_onlyで論文をアップロードすると、作成した組織ページに表示される', async ({ page }) => {
        await loginAsTestUser(page);

        // Org作成
        const orgName = generateTestOrgName();
        const orgSlug = orgName.toLowerCase().replace(/_/g, '-');
        await createOrg(page, { name: orgName, slug: orgSlug });

        // org_only論文をアップロード
        const orgOnlyTitle = generateTestPaperTitle();
        const paperId = await uploadOrgOnlyPaper(page, orgOnlyTitle);

        // 論文が正常に作成されたことを確認
        await page.goto(`/papers/${paperId}`);
        await expect(page.getByRole('heading', { name: orgOnlyTitle })).toBeVisible();
        await expect(page.getByText('組織内')).toBeVisible();

        // 作成した組織ページにも表示されることを確認（orgId紐づけの確認）
        await page.goto(`/orgs/${orgSlug}`);
        await expect(page.getByRole('link', { name: orgOnlyTitle })).toBeVisible();
    });
});
