# Issue → PR → Review Loop Runbook

このドキュメントは、OpenShelfで **open issue を実装PRで解決し、open PR のレビューをクローズする** ための実運用手順です。  
`.github/agents/pr-review-closure-loop.md` と `.github/copilot-instructions.md` の内容を、実行順に整理しています。

## 目的

- open issue を取りこぼしなく実装して PR 化する
- 各 PR のレビュー会話を `ADDRESS / IGNORE_WITH_REASON` で必ず処理する
- required checks が green になるまでループを回す

## 前提

- リポジトリ: `Hiroki-org/OpenShelf`
- ローカルで `gh` が利用可能
- 基本検証コマンド:
  - `npm run typecheck`
  - `npm run test`
  - `npm run lint`

## フェーズ1: open issue の棚卸し

1. open issue 一覧を取得

   ```bash
   gh issue list --state open --limit 100
   ```

2. 各 issue の本文とコメントを取得

   ```bash
   gh issue view <ISSUE_NUMBER> --comments
   ```

3. issue ごとに「完了条件」を明文化してから着手する  
   （実装前に scope が曖昧なまま進めない）

## フェーズ2: issue ごとに実装PRを作る

issue ごとに以下を繰り返します。

1. `main` からブランチ作成

   ```bash
   git checkout main
   git pull --ff-only
   git checkout -b feat/issue-<number>-<short-topic>
   ```

2. 実装 + テスト追加

3. ローカル検証

   ```bash
   npm run typecheck && npm run test && npm run lint
   ```

4. コミット・push

   ```bash
   git add -A
   git commit -m "feat(<scope>): <summary>"
   git push -u origin <branch>
   ```

5. PR作成（必ず issue を close 連携）

   ```bash
   gh pr create --base main --head <branch> --title "<title>" --body "...\n\nCloses #<ISSUE_NUMBER>"
   ```

## フェーズ3: open PR review closure loop

`open` な全PRに対して、以下をループします。

1. PRの未解決レビュー会話を取得

   ```bash
   gh pr view <PR_NUMBER> --json reviews,comments,statusCheckRollup
   ```

2. 各スレッドを判定
   - `ADDRESS`: 修正を実装
   - `IGNORE_WITH_REASON`: 仕様根拠付きで見送り理由を返信

3. **必ず返信してから** スレッドを resolve  
   （返信なし resolve 禁止）

4. 修正がある場合は push し、required checks を監視

   ```bash
   gh pr checks <PR_NUMBER> --required --watch --interval 10
   ```

5. しばらく待って再取得（例: 300秒）

   ```bash
   sleep 300
   gh pr view <PR_NUMBER> --json reviews,statusCheckRollup
   ```

6. 停止条件
   - unresolved conversation = 0
   - required checks = 全て success

## 判定ポリシー

- 基本は `ADDRESS` 優先
- `IGNORE_WITH_REASON` は以下を満たす場合のみ許可
  - 明確な仕様・要件根拠がある
  - 返信で根拠を明示した

## 運用テンプレート

### ADDRESS 返信テンプレート

`対応しました: <変更内容>. 影響範囲: <scope>. 検証: <tests/checks>.`

### IGNORE_WITH_REASON 返信テンプレート

`今回は対応見送りとします。理由: <技術的根拠>. 前提/代替: <補足>.`

## チェックリスト

- [ ] open issue の本文+コメントを確認した
- [ ] issue ごとに 1PR 以上作成した
- [ ] すべてのPRで `Closes #<issue>` を付けた
- [ ] 各レビュー会話に返信した
- [ ] unresolved threads が 0
- [ ] required checks が green

