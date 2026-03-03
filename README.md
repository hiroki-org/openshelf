# OpenShelf

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
├── web/   ← Next.js (React 19, Tailwind CSS v4)
│           ├─ App Router / TypeScript
│           └─ Docker self-host + Vercel 両対応
│
└── api/   ← Hono + Cloudflare Workers バックエンド
            ├─ D1 (SQLite) + R2 ストレージ
            ├─ JWT + GitHub OAuth
            └─ マルチオリジン CORS 対応
```

**技術スタック:**

| Phase    | Tech                                                |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 15+, React 19, TypeScript 5, Tailwind CSS 4 |
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
   - `API_URL`: デプロイ済みの Cloudflare Worker URL
   - `FRONTEND_URL`: 自身の URL (例: `https://openshelf.vercel.app`)

   **CLI での設定例:**

   ```bash
   vercel env add FRONTEND_URL production
   ```

#### Cloudflare Workers Deployment (API)

1. Cloudflare D1 と R2 のバケットを作成し、`wrangler.toml` に設定。
2. **環境変数の設定**:
   機密情報は **Secrets**、それ以外は **Vars** として設定します。
   - **Secrets (npx wrangler secret put で設定)**:
     - `GITHUB_CLIENT_SECRET`
     - `JWT_SECRET`

   - **Vars (wrangler.toml [vars] またはデプロイ時)**:
     - `GITHUB_CLIENT_ID`
     - `FRONTEND_URL`

   **デプロイ時の注入例:**

   ```bash
   npx wrangler deploy --var FRONTEND_URL:https://openshelf.vercel.app
   ```

   > [!IMPORTANT]
   > `process.env` は Worker 環境では `c.env` にマッピングされないため、Wrangler 経由で明示的に注入する必要があります。

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

MIT License
