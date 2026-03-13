# OpenShelf API

## D1 マイグレーションルール

- 適用済みマイグレーションファイルは**イミュータブル**（変更禁止）
- スキーマ変更は必ず新しい番号のファイルで追加する（例: `0004_add_column.sql`）
- `main` マージ時に GitHub Actions が自動で `wrangler d1 migrations apply DB --remote` を実行する
- PR で既存マイグレーションファイルを変更すると CI が fail する

## GitHub Actions 用 Secrets

GitHub Actions で API デプロイを実行するため、リポジトリ Secrets に以下を設定してください。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
