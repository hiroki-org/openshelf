# OpenShelf

OpenShelf は、研究機関やチーム内で研究成果物（論文、データセット、スライド等）を安全にアップロードし、共有するためのファイルホスティングプラットフォームです。

利用者は GitHub アカウントを用いて安全にログインし、成果物を素早く公開・共有できます。

## 主な機能・利用メリット

- **シンプルなファイル共有**: ドラッグ＆ドロップで成果物をアップロードし、すぐに共有リンクを発行できます。
- **GitHub アカウント連携**: 新たなパスワードを管理する必要はありません。お使いの GitHub アカウントでログイン可能です。
- **招待制アクセス**: 限られたメンバーだけが利用できるように、既存のユーザーが新規ユーザーを招待するシステムを採用しています。

---

## 使い方 (ユーザー向け)

OpenShelf（Vercel 上で提供されている URL）にアクセスして以下の手順で利用を開始します。

### 1. ログイン・新規登録
- トップ画面の「Sign in with GitHub」ボタンからログインします。
- **注意**: OpenShelf は招待制です。初めて利用する場合は、すでに利用しているメンバーから**招待リンク (Invite Link)** を発行してもらう必要があります。

### 2. ファイルのアップロード
- ログイン後、アップロード画面から成果物となるファイルをアップロードします。
- タイトルや著者名などのメタデータを併せて登録できます。

### 3. ファイルの共有
- アップロードが完了すると、ファイル専用の URL が発行されます。
- この URL を共同研究者やチームメンバーに共有することで、ブラウザから簡単に成果物を閲覧・ダウンロードできます。

### 4. メンバーの招待
- 自分が他のメンバーをチームに加えたい場合は、設定・招待画面から「Create Invite Link」を選択して招待 URL を発行します。
- 発行した URL を新しいメンバーに送ることで、その人も GitHub アカウントで登録できるようになります。

---

## 開発者・システム管理者向け (Local Setup & Deployment)

OpenShelf は Next.js (Web) と Hono + Cloudflare Workers (API) で構成されるモノレポです。
ご自身の環境や Vercel/Cloudflare にシステム自体をデプロイする場合は以下を参照してください。

### Local Setup

#### API (`apps/api`)

`apps/api/.dev.vars` を作成して以下を設定します。

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
```
※ `FRONTEND_URL` は OAuth コールバック後のリダイレクト先と CORS 判定に使われます。

#### Web (`apps/web`)

`next.config.ts` は `/api/*` を `API_URL` にプロキシします。未設定時は `http://localhost:8787` を使用します。

```bash
API_URL=http://localhost:8787
```

### Vercel Deployment (Web)

Next.js アプリケーション (`apps/web`) を Vercel にデプロイする手順です。

1. **Vercel にリポジトリをインポート**
2. **Project Settings の設定**
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web` (重要: 設定必須)
3. **Environment Variables の設定**
   - `API_URL`: Cloudflare Workers にデプロイした API の URL

### Cloudflare Workers Deployment (API)

Hono API (`apps/api`) をデプロイする手順です。

1. **Cloudflare D1 と R2 の作成**: Wrangler コマンドで作成し、バインディングを追加。
2. **環境変数の設定**: Cloudflare Worker のシークレットとして `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, `FRONTEND_URL` (VercelのWeb URL) を設定。
3. **デプロイ**: `cd apps/api && npm run deploy`
