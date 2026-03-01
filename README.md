# OpenShelf

研究成果物（論文・発表資料など）を安全に保管・管理・共有するための Web プラットフォーム。

## 📋 Overview

**主な機能:**

- 📄 **ファイルホスティング**: Cloudflare R2 を活用した安全なファイル保存
- 🔗 **共有リンク生成**: 論文や資料を簡単にシェア
- 👥 **コラボレーション**: 共著者リクエストと管理機能
- 🔐 **認証**: GitHub OAuth を使った安全なログイン
- 🚀 **複数デプロイ方式**: クラウド（Vercel/Cloudflare）またはオンプレミス（Docker）に対応

---

## 🏗️ Architecture

OpenShelf は npm workspaces を使った monorepo で構成。

```
apps/
├── web/   ← Next.js 16 フロントエンド (React 19, Tailwind CSS v4)
│           ├─ App Router / TypeScript
│           └─ Docker self-host + Vercel 両対応
│
└── api/   ← Hono + Cloudflare Workers バックエンド
            ├─ D1 (SQLite) + R2 ストレージ
            ├─ JWT + GitHub OAuth
            └─ マルチオリジン CORS 対応
```

**Tech Stack:**

| Phase    | Tech                                               |
| -------- | -------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend  | Hono 4, Cloudflare Workers                         |
| Database | SQLite (D1)                                        |
| Storage  | Cloudflare R2                                      |
| Auth     | GitHub OAuth 2.0, JWT                              |
| Testing  | Vitest                                             |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x+, npm 10.x+
- GitHub OAuth App
- (Optional) Cloudflare account

### 1. Clone & Install

```bash
git clone https://github.com/Hiroki-org/OpenShelf.git
cd OpenShelf
npm install
```

### 2. Setup GitHub OAuth

1. [GitHub Settings > Developer Settings > OAuth Apps](https://github.com/settings/developers)
2. **New OAuth App** → Fill in:
   - Application name: `OpenShelf (Dev)`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback: `http://localhost:3000/auth/callback`
3. Save `Client ID` and `Client Secret`

### 3. Environment Variables

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

### 4. Run Development

```bash
# Terminal 1: API
npm run dev --workspace apps/api

# Terminal 2: Web
npm run dev --workspace apps/web
```

Open http://localhost:3000

---

## 🧪 Testing & Quality

```bash
npm run test              # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run typecheck        # TypeScript check
npm run lint             # ESLint check
```

---

## 🚀 Deployment

### Vercel (Recommended)

Frontend is Vercel-ready:

```bash
vercel link
vercel deploy
```

### Cloudflare Workers

```bash
wrangler publish
```

### Docker Self-Host (On-Prem / VPS)

See [apps/web/README.md#self-host-docker](./apps/web/README.md#self-host-docker) for detailed guide.

**Quick Start:**

```bash
docker build -f apps/web/Dockerfile \
  -t openshelf-web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .

docker run -d --name openshelf \
  -p 3000:3000 \
  -e API_URL=https://api.example.com \
  -e GITHUB_CLIENT_ID=... \
  -e GITHUB_CLIENT_SECRET=... \
  openshelf-web
```

**Docker Compose (HTTPS):**

```bash
docker-compose up -d
```

---

## 🔐 Authentication

### GitHub OAuth Flow

1. User clicks **"Sign in with GitHub"**
2. Redirects to GitHub authorization
3. Callback → API issues JWT token
4. Redirect to `/auth/callback#token=<jwt>`
5. Frontend parses JWT from URL fragment

### CORS (Multi-Origin)

API supports comma-separated `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=https://vercel-url.com,http://localhost:3000
```

Falls back to `FRONTEND_URL` if not set.

---

## 📁 Project Structure

```
apps/web/
├── src/app/           ← Pages, layouts
├── src/components/    ← React components
├── src/lib/           ← API client, utilities
├── Dockerfile         ← Docker build
└── next.config.ts     ← API rewrite, standalone

apps/api/
├── src/index.ts       ← App, CORS setup
├── src/routes/        ← API endpoints
├── src/db/            ← Schema (Drizzle)
├── drizzle/           ← Migrations
└── wrangler.toml      ← Worker config
```

---

## 📚 Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Hono](https://hono.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team)

---

## 📄 License

MIT License

---

## 🤝 Contributing

Issues & PRs welcome! Fork, branch, commit, and open a PR against `main`.
