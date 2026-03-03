# OpenShelf

研究成果物ファイルをホストするためのアプリケーション。
Next.js (Web) と Hono + Cloudflare Workers (API) で構成されるモノレポです。

## 主な機能

- **ファイルホスティング**: 研究成果物やファイルをアップロード・共有。
- **GitHub OAuth**: GitHub アカウントによる認証。
- **招待制システム**: アクセスを制限する招待機能。
- **Cloudflare エコシステム連携**: D1 (データベース) と R2 (ストレージ) を利用。

## Local Setup

### API (`apps/api`)

`apps/api/.dev.vars` を作成して以下を設定します。

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
```

`FRONTEND_URL` は OAuth コールバック後のリダイレクト先と CORS 判定に使われます。

### Web (`apps/web`)

`next.config.ts` は `/api/*` を `API_URL` または `NEXT_PUBLIC_API_URL` にプロキシします。
未設定時は `http://localhost:8787` を使用します。

```bash
API_URL=http://localhost:8787
```

## Vercel Deployment (Web)

Next.js アプリケーション (`apps/web`) を Vercel にデプロイする手順です。

1. **Vercel にリポジトリをインポート**
2. **Project Settings の設定**
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web` (重要: これを設定しないとビルドに失敗します)
3. **Environment Variables (環境変数) の設定**
   - `API_URL`: Cloudflare Workers にデプロイした API の URL (例: `https://api.yourdomain.workers.dev`)
     - ※ Vercel の API Routes からのリバースプロキシ (Rewrite) に使用されます。

## Cloudflare Workers Deployment (API)

Hono API (`apps/api`) を Cloudflare Workers にデプロイする手順です。

1. **Cloudflare D1 データベースと R2 バケットの作成**
   - Wrangler コマンド等を使用してリソースを作成し、`wrangler.toml` (または相当の設定) にバインディングを追加します。
2. **環境変数とシークレットの設定**
   本番環境では Cloudflare のダッシュボード（または `wrangler` CLI）で以下を設定してください。

   - **シークレット (Secrets)**: 機密情報。`wrangler secret put <KEY>` で設定します。
     - `GITHUB_CLIENT_ID`
     - `GITHUB_CLIENT_SECRET`
     - `JWT_SECRET`
   - **環境変数 (Variables)**:
     - `FRONTEND_URL`: Vercel にデプロイした Web 側の本番 URL (例: `https://openshelf.vercel.app`)
       - ※ これを正しく設定しないと、OAuth ログイン後のリダイレクトや CORS でエラーになります。
3. **デプロイの実行**
   ```bash
   cd apps/api
   npm run deploy
   ```
