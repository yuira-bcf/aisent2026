---
description: データベース・Drizzle ORM のルール
globs: ["packages/db/**/*.ts", "apps/web/lib/services/**/*.ts"]
---

# データベースルール

## Drizzle ORM
- スキーマ定義: `packages/db/src/schema/` にドメイン別ファイル
- クライアント: `packages/db/src/client.ts`
- マイグレーション: `drizzle-kit generate` → `drizzle-kit push`

## テーブル設計規約
- 主キー: UUID（`uuid().primaryKey().defaultRandom()`）
- タイムスタンプ: `createdAt`, `updatedAt` を全テーブルに付与
- Enum: `pgEnum` で定義
- リレーション: `relations()` で明示的に定義
- インデックス: クエリパターンに応じて追加

## 既存Enumの一覧（追加時は既存を再利用）
- `roleEnum`: CUSTOMER, CREATOR, ADMIN
- `noteTypeEnum`: TOP, MIDDLE, LAST
- `categoryEnum`: SEASON, PLACE, MOOD
- `blendStatusEnum`: PENDING, PROCESSING, COMPLETED, FAILED
- `orderStatusEnum`: 9段階（PENDING→DELIVERED/CANCELLED/RETURNED）
- `recipeStatusEnum`: DRAFT, PUBLISHED, ARCHIVED
- `applicationStatusEnum`: PENDING, APPROVED, REJECTED, CANCELLED
- `tierEnum`: BRONZE, SILVER, GOLD, PLATINUM

## マスタデータ
- 香料: 26種（TOP 8, MIDDLE 10, LAST 8）
- プリセットキーワード: 16種（SEASON 4, PLACE 3, MOOD 9）
- 管理者: admin@kyarainnovate.com（seed.ts で作成）

## トランザクション
- 複数テーブルへの書き込みは `db.transaction()` で囲む
- 注文作成、ルール一括保存、調合実行は必ずトランザクション内

## 金額
- `decimal(10, 0)` で円単位（小数なし）
- 計算時は `Decimal.js` を使用
- カラム名は `priceYen`, `totalYen` で統一
