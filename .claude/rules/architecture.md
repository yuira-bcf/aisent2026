---
description: アーキテクチャ・レイヤー構成のルール
globs: ["apps/web/**/*.{ts,tsx}"]
---

# アーキテクチャルール

## レイヤー構成

```
Page (Server Component) → Service Layer → Drizzle ORM → PostgreSQL
     ↕                        ↕
Client Component          API Route (/api/v1/)
```

## ルール

### ページ層（app/）
- データ取得は Server Component で直接 service を呼ぶ
- Client Component は `"use client"` で明示し、最小限に
- ISR が必要な場合は `revalidate` を設定

### API Route 層（app/api/v1/）
- 全エンドポイントに `/api/v1/` プレフィックスを付与
- `auth-guard.ts` でロールベースアクセス制御
- `rate-limiter.ts` でレート制限
- Zod でリクエストバリデーション
- レスポンス形式: `{ data: T }` or `{ error: string }`

### サービス層（lib/services/）
- ビジネスロジックはここに集約
- DB操作は Drizzle ORM 経由のみ
- トランザクションが必要な場合は `db.transaction()` を使用
- サービス間の依存は最小限に

### スキーマ層（packages/db/）
- テーブル定義は `src/schema/` 配下にドメイン別ファイルで管理
- リレーションも同ファイル内で定義
- `src/index.ts` から全スキーマをエクスポート

## 新機能追加時のチェックリスト
1. 設計書（docs/01systemdesign/）を確認
2. DBスキーマ追加 → `npm run db:generate` → `npm run db:push`
3. サービス層にロジック実装
4. API Route作成（Zod + auth-guard）
5. ページ・コンポーネント実装
6. テスト追加
7. `npm run check && npm run lint && npm run test` で確認
