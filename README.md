# OpenShelf

研究成果物ファイルをホストするためのアプリケーション。

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

## Deploy Note

本番環境では `FRONTEND_URL` を本番 Web URL に設定してください。
Cloudflare 側で Worker の環境変数として上書きし、OAuth リダイレクト先と一致させる必要があります。
