This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Self-host (Docker)

This app supports standalone Docker deployment for on-prem or VPS environments.

Required environment variables:

- `NEXT_PUBLIC_API_URL`: Public API base URL embedded at build time for browser requests.
- `API_URL`: Runtime API base URL used by Next.js server-side rewrite (`/api/*`).
- `GITHUB_CLIENT_ID`: GitHub OAuth App client ID.
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App client secret.

Build image (run from monorepo root because `package-lock.json` is at root):

```bash
docker build \
	-f apps/web/Dockerfile \
	-t openshelf-web:latest \
	--build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
	.
```

Run container:

```bash
docker run --rm -p 3000:3000 \
	-e API_URL=https://api.example.com \
	-e GITHUB_CLIENT_ID=your-client-id \
	-e GITHUB_CLIENT_SECRET=your-client-secret \
	openshelf-web:latest
```

Note for Workers CORS:

- Add your Docker-hosted frontend origin (for example `http://localhost:3000` or your production domain) to `ALLOWED_ORIGINS` in Cloudflare Workers settings.
- `FRONTEND_URL` remains as a fallback when `ALLOWED_ORIGINS` is not configured.
