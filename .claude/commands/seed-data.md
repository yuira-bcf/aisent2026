---
description: テスト用シードデータを生成・投入
---

# /seed-data

テスト用のシードデータを生成・投入してください。

## 手順

1. PostgreSQL が起動しているか確認（`docker compose up db`）
2. 既存シードの実行: `npm run db:seed`
3. 追加データが必要な場合は `packages/db/src/seed.ts` を更新

## 標準シードデータ

既に `seed.ts` に含まれるもの:
- 香料 26種（TOP 8, MIDDLE 10, LAST 8）
- プリセットキーワード 16種（SEASON 4, PLACE 3, MOOD 9）
- 管理者ユーザー（admin@kyarainnovate.com / パスワードはハッシュ済み）

## 追加シードデータ（必要に応じて）

指示があれば以下を `seed.ts` に追加:
- テスト用カスタマー（customer@test.com）
- テスト用クリエーター（creator@test.com + creatorProfile）
- サンプルブレンドリクエスト・結果
- サンプル商品・注文
- サンプルレシピ
- キーワード→香料ルール（クリエーター別）

## 注意事項

- `onConflictDoNothing()` で冪等性を保つ
- パスワードは bcryptjs でハッシュ化
- 本番データを含めない（テスト用データのみ）
