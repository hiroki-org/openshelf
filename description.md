🚨 深刻度: HIGH
💡 脆弱性: ALLOWED_ORIGINS の設定にワイルドカードが含まれている場合、CORSおよびCSRFミドルウェアでの `isAllowedOrigin` チェックがクライアントからの任意のオリジンを許可してしまい、オリジン検証のバイパスやオープンリダイレクトが発生する可能性があります。
🎯 影響: トークンが盗まれるなど、深刻なセキュリティリスクにつながる可能性があります。
🔧 修正内容: `apps/api/src/index.ts` の CORS設定および CSRFチェックにおいて、`isAllowedOrigin` 呼び出し時に明示的に `{ allowWildcard: false }` を渡すように修正し、ワイルドカードによる一致を無効化しました。
✅ 検証方法: `bun x vitest run apps/api/src/routes/__tests__/csrf.test.ts` および関連するテストを実行し、テストがパスすることを確認済みです。
