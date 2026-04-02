# OpenShelf

<p align="center">
  <a href="https://github.com/Hiroki-org/OpenShelf/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Hiroki-org/OpenShelf/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white" alt="CI" /></a>
  <a href="https://codecov.io/gh/Hiroki-org/OpenShelf"><img src="https://codecov.io/gh/Hiroki-org/OpenShelf/branch/main/graph/badge.svg" alt="codecov" /></a>
  <a href="https://github.com/Hiroki-org/OpenShelf/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Hiroki-org/OpenShelf" alt="License" /></a>
  <a href="https://github.com/Hiroki-org/OpenShelf/commits/main"><img src="https://img.shields.io/github/last-commit/Hiroki-org/OpenShelf/main" alt="Last Commit" /></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/eslint-v9-4B32C3?logo=eslint&logoColor=white" alt="ESLint" />
  <img src="https://img.shields.io/badge/npm_workspaces-monorepo-CB3837?logo=npm&logoColor=white" alt="npm workspaces" />
</p>

OpenShelf は、研究成果物（論文、プレゼン資料、データセット等）を安全にアップロードし、共有するためのファイルホスティングプラットフォームです。

利用者は GitHub アカウントを用いて安全にログインし、成果物を素早く公開・共有できます。Cloudflare Workers (Hono) と Next.js を組み合わせたモダンな構成で、スケーラビリティとセキュリティを両立しています。

## 📋 主な機能・利用メリット

- 📄 **ファイルホスティング**: Cloudflare R2 を活用した安全で低コストなファイル保存。
- 🔗 **共有リンク生成**: アップロード後、即座に共有用の URL を発行。
- 👥 **コラボレーション**: 招待制アクセスによるチーム内共有と、共著者（Co-author）管理機能。
- 🔐 **セキュアな認証**: GitHub OAuth 2.0 と JWT を使用。
- 🚀 **複数デプロイ対応**: クラウド（Vercel/Cloudflare）またはオンプレミス（Docker）にデプロイ可能。

---

## 🏗️ サービス構成 (Architecture)

OpenShelf は npm workspaces を使ったモノレポ構成です。

```
apps/
├── web/   ← Web フロントエンド (Next.js)
│           ├─ App Router 採用
│           └─ Docker / Vercel 両対応
│
└── api/   ← API バックエンド (Hono / Workers)
            ├─ D1 (DB) / R2 (Storage)
            └─ GitHub OAuth 認証
```

**技術スタック:**

| Phase    | Tech                                                |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 16+, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend  | Hono 4, Cloudflare Workers                          |
| Database | SQLite (D1) / Drizzle ORM                           |
| Storage  | Cloudflare R2                                       |
| Auth     | GitHub OAuth 2.0, JWT                               |
| Testing  | Vitest, Playwright (E2E)                            |

---

## 使い方 (ユーザー向け)

### 1. ログイン・新規登録

- トップ画面の「Sign in with GitHub」ボタンからログインします。
- **注意**: OpenShelf は招待制です。初めて利用する場合は、すでに利用しているメンバーから**招待リンク (Invite Link)** を受け取ってください。

### 2. ファイルのアップロード

- ログイン後、「Upload」画面から成果物となるファイルを登録します。
- タイトル、アブストラクト、公開範囲（Public, Org-Only, Private）などのメタデータを設定できます。

### 3. ファイルの共有・共著者招待

- アップロード完了後、詳細ページから共有 URL をコピーできます。
- 「Co-author Invite」機能を使うことで、他のユーザーを共著者として追加し、編集権限を共有できます。

---

## 開発者・システム管理者向け (Setup & Deployment)

### ローカルセットアップ (Local Setup)

1. **リポジトリのクローンとインストール**

   ```bash
   git clone https://github.com/Hiroki-org/OpenShelf.git
   cd OpenShelf
   npm install
   ```

2. **GitHub OAuth App の作成**
   - [GitHub Developer Settings](https://github.com/settings/developers) で新規アプリを作成。
   - `Homepage URL`: `http://localhost:3000`
   - `Authorization callback URL`: `http://localhost:3000/auth/callback`

3. **環境変数の設定**

   **API (`apps/api/.dev.vars`):**

   ```env
   GITHUB_CLIENT_ID=<your-client-id>
   GITHUB_CLIENT_SECRET=<your-client-secret>
   JWT_SECRET=dev-secret-change-in-prod
   FRONTEND_URL=http://localhost:3000
   ```

   **Web (`apps/web/.env.local`):**

   ```env
   API_URL=http://localhost:8787
   NEXT_PUBLIC_API_URL=http://localhost:8787
   ```

4. **起動**
   ```bash
   # API: cd apps/api && npm run dev
   # Web: cd apps/web && npm run dev
   ```

---

### デプロイ (Deployment)

#### Vercel Deployment (Web)

1. Vercel に `apps/web` を Root Directory としてインポート。
2. **Environment Variables** に以下を設定:
   - `NEXT_PUBLIC_API_URL`: デプロイ済みの Cloudflare Worker URL（ブラウザ側 OAuth 開始・API 呼び出しで使用）
   - `API_URL`: デプロイ済みの Cloudflare Worker URL
   - `FRONTEND_URL`: 自身の URL (例: `https://openshelf.vercel.app`)

   **CLI での設定例:**

   ```bash
   vercel env add FRONTEND_URL production
   ```

#### Cloudflare Workers Deployment (API)

OpenShelf API は staging / production の 2 環境で運用します。

- `apps/api/wrangler.toml` では `[env.staging]` と `[env.production]` を定義しています。
- トップレベルに D1 / R2 の binding は置いていません。`wrangler dev`、`wrangler deploy`、`wrangler d1 migrations apply` などの環境依存コマンドは、必ず `--env staging` または `--env production` を指定してください。
- デプロイは GitHub Actions 経由で行います（`apps/api/**` の変更がある push のみトリガー）。
  - `staging` ブランチへの push → staging 環境へ自動デプロイ
  - `main` ブランチへの push → production 環境へ自動デプロイ
- デプロイ時には `wrangler d1 migrations apply` が各環境に対して自動実行されます。

#### 開発フロー

通常の開発フロー（staging 先行）:

1. `main` から feature branch を作成
2. 実装・ローカルテスト
3. `staging` 宛てに PR を作成（CI が自動実行）
4. レビュー・マージ → staging に自動デプロイ
5. staging 環境で動作確認
6. 問題なければ `staging` → `main` へ PR を作成
7. マージ → production に自動デプロイ

> [!NOTE]
> `main` 宛てに PR を作成した場合、source が `staging` でなければ `staging` に自動で retarget されます。
> Ruleset の bypass 権限を持つ admin は `main` 宛て PR をそのまま維持できます。
> なお、`main` マージ後は production が先にデプロイされ、その後 `main` を `staging` に同期します。

緊急 hotfix:

1. `main` から hotfix branch を作成
2. `staging` 宛てに PR を作成して staging で動作確認
3. 問題なければ `staging` → `main` の PR を作成
4. マージ → production に自動デプロイ

> [!NOTE]
> rollback / E2E テスト戦略の詳細化は今後整理します。

#### D1 マイグレーション運用

- マイグレーションファイルは `apps/api/drizzle/` に配置します。
- 適用済みマイグレーションはイミュータブルです。既存ファイルは変更せず、新しい番号のファイルを追加してください。
- スキーマ変更があるたびに、新しい番号のマイグレーションファイルを追加します。
- デプロイ時に `wrangler d1 migrations apply` が staging / production それぞれに対して自動実行されます。
- ローカルでは `npm run db:migrate:local`、リモートでは `npm run db:migrate:remote` を使います。
- 既存マイグレーションファイルの変更は CI で検知されます。

#### Secrets 管理

- GitHub Actions Secrets
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Workers Secrets (`npx wrangler secret put` で環境ごとに設定)
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `JWT_SECRET`
- `apps/api/wrangler.toml` の `[vars]`
  - `FRONTEND_URL`
  - `ALLOWED_ORIGINS`
  - `NODE_ENV`

#### Docker (Self-Host / VPS)

詳細は [apps/web/README.md#self-host-docker](./apps/web/README.md#self-host-docker) を参照してください。

---

## 🧪 テスト・品質管理

```bash
npm run test           # API単体テスト
npm run typecheck      # 型チェック
npm run lint           # リンター実行
# E2Eテスト (apps/e2e)
cd apps/e2e && npx playwright test
```

---

## 📄 ライセンス

[MIT License](./LICENSE)
