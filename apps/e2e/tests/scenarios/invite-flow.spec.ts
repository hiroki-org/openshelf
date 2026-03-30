import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { loginAsTestUser } from '../../helpers/auth';
import { uploadPublicPaper } from '../../helpers/paper';

test.describe('Coauthor Invite Flow', () => {
  test('アップローダーが共著者招待を送り、招待されたユーザーが承認できること', async ({
    page,
    browser,
  }) => {
    const inviterGithubId = randomUUID();
    await loginAsTestUser(page, {
      githubId: inviterGithubId,
      name: `inviter-${randomUUID().slice(0, 6)}`,
    });

    const title = `Invite Paper ${randomUUID().slice(0, 8)}`;
    const paperId = await uploadPublicPaper(page, title);

    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    const inviteeName = `invitee-${randomUUID().slice(0, 10)}`;
    try {
      const inviteePayload = await loginAsTestUser(inviteePage, {
        name: inviteeName,
      });

      await page.goto(`/papers/${paperId}`);
      await page.getByRole('button', { name: '+ 共著者を招待' }).click();

      const searchBox = page.getByPlaceholder('ユーザー名で検索...');
      await searchBox.fill(inviteeName);
      const resultRow = page.locator('li', { hasText: inviteeName }).first();
      await expect(resultRow).toBeVisible();
      await resultRow.getByRole('button', { name: '招待' }).click();

      await expect(page.getByText('招待を送信しました')).toBeVisible();
      await expect(page.getByText('招待状況')).toBeVisible();
      await expect(page.locator('li', { hasText: inviteeName })).toContainText('保留中');

      await inviteePage.goto('/invites');
      const inviteCard = inviteePage.locator('li', { hasText: title }).first();
      await expect(inviteCard).toContainText('保留中');
      await inviteCard.getByRole('button', { name: '承認' }).click();
      await expect(inviteCard).toContainText('承認済み');

      await inviteePage.goto(`/papers/${paperId}`);
      await expect(inviteePage.getByRole('heading', { name: title })).toBeVisible();
      await expect(
        inviteePage.locator('li', { hasText: inviteePayload.name }).first(),
      ).toBeVisible();
    } finally {
      await inviteeContext.close();
    }
  });
});
