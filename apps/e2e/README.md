# Playwright E2E Tests

このディレクトリは、OpenShelfのE2Eテスト（エンドツーエンドテスト）を管理・実行するための基盤です。フロントエンド（Next.js）およびバックエンド（Cloudflare Workers + D1/R2）の統合的な動作検証を目的としています。

## テストの目的

- 実際のブラウザ環境を通して、ユーザーの主要な操作フロー（ログイン〜アップロード〜閲覧）が正しく機能することを保証する。
- 認証周りや非公開設定など、ブラウザの状態に依存しやすいP0機能のリグレッションを防ぐ。

## ローカルでの実行手順

### 前提条件

- リポジトリのルートでのパッケージインストール(`npm install`)が完了していること。
- Playwrightのインストールが完了していること。

  ```bash
  cd apps/e2e
  npm install
  npx playwright install --with-deps chromium
  ```

### 実行コマンド

`apps/e2e`ディレクトリで以下のコマンドを実行します。

```bash
npm run test     # CUIでテストを実行
npm run test:ui  # PlaywrightのUIモードでテストを実行（デバッグに最適）
```

※ コマンドを実行すると、Playwrightが自動的にNext.jsとWranglerの開発サーバーをバックグラウンドで起動しテストを行います。テスト用の認証エンドポイントを有効にするため自動で変数セットアップ等を処理します。

## CIでの実行について

`.github/workflows/ci.yml` により、`main`へのPush時またはプルリクエスト作成時にGitHub Actionsで自動的にE2Eテストが実行されます。
テスト失敗時のスクリーンショットやトレースはActionsのArtifactsとして保存されるため、CI上で失敗した場合の問題特定が容易です。

## テストの追加方法

- 新しい機能のテストケースを追加する場合は、`apps/e2e/tests/` ディレクトリ内に `*.spec.ts` ファイルを作成または追記してください。
- 認証が必要な操作の場合は、`helpers/auth.ts` の `loginAsTestUser(page)` を呼び出すことで、テスト用ユーザーのJWTを自動で取得・注入できます。
