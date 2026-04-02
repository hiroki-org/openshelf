# OpenShelf API

## D1 マイグレーションルール

- 適用済みマイグレーションファイルは**イミュータブル**（変更禁止）
- スキーマ変更は必ず新しい番号のファイルで追加する（例: `0004_add_column.sql`）
- `main` マージ時に GitHub Actions が自動で `wrangler d1 migrations apply DB --remote` を実行する（`DB` は `wrangler.toml` の D1 binding 名）
- PR で既存マイグレーションファイルを変更すると CI が fail する

## Badge API

- `GET /badge/:paperId` は SVG バッジを返します。
- `GET /badge/api/:paperId` は `https://img.shields.io/endpoint` 互換の JSON を返します。
- `GET /badge/api/:paperId` は存在しない論文や非公開論文でも、通常の API エラー形式 `{ error: string }` ではなく、shields.io 互換の `{ schemaVersion, label, message, color }` を 404 で返します。これは埋め込み先が成功時と同じ JSON 契約を前提にできるようにするためです。

## GitHub Actions 用 Secrets

GitHub Actions で API デプロイを実行するため、リポジトリ Secrets に以下を設定してください。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
