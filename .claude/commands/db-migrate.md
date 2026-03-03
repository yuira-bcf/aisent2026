---
description: Drizzleマイグレーション生成→適用→シードを一括実行
---

# /db-migrate

DBマイグレーションを一括で実行してください。

## 手順

1. `packages/db/src/schema/` の変更内容を確認
2. `npm run db:generate` でマイグレーションSQLを生成
3. 生成されたSQLファイルの内容を表示して確認
4. `npm run db:push` でスキーマをDBに適用
5. 必要に応じて `npm run db:seed` でシードデータを投入
6. 適用結果を `npx drizzle-kit studio` ではなくSQLで確認

## 注意事項

- PostgreSQLが起動していることを確認（`docker compose up db`）
- 破壊的変更（カラム削除・型変更）がある場合は警告を表示
- マイグレーション生成後、SQLの内容をユーザーに提示してから適用
