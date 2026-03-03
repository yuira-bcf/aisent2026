---
description: TypeScript/React コーディング規約
globs: ["apps/**/*.{ts,tsx}", "packages/**/*.ts"]
---

# コーディング規約

## TypeScript
- strict モードを維持（`tsc --noEmit` エラーゼロ）
- `any` 型は禁止。`unknown` + 型ガードを使用
- 型定義は使用箇所の近くに配置。共有型のみ別ファイル
- Enum は使わない。Drizzle の pgEnum または `as const` を使用
- `!` (non-null assertion) は原則禁止。null チェックを書く

## React / Next.js
- Server Component をデフォルトで使用。`"use client"` は必要最小限
- データ取得は Server Component で行い、Client Component に props で渡す
- フォームは Server Actions を使用（`"use server"`）
- ルートハンドラ（API Route）は `/app/api/v1/` 配下に配置
- コンポーネントは `components/` に配置。ページ固有のものはページ横に配置

## Biome
- `npx biome check .` でエラーゼロを維持
- フォーマットは Biome に任せる（Prettier は使わない）
- import の並び替えも Biome が管理

## 命名規則
- ファイル: kebab-case（`blend-calculator.ts`）
- コンポーネント: PascalCase（`BlendResult.tsx` → `export function BlendResult`）
- 変数・関数: camelCase
- DB テーブル/カラム: camelCase（Drizzle の規約に従う）
- API パス: kebab-case（`/api/v1/blend-results`）
- 環境変数: UPPER_SNAKE_CASE

## エラーハンドリング
- API Route では try-catch で囲み、統一レスポンス形式で返す
- `NextResponse.json({ error: "message" }, { status: 4xx })` を使用
- サービス層では例外を throw し、API Route でキャッチ

## インポート
- 相対パスではなくパスエイリアス `@/` を使用
- `import { db } from "@repo/db"` でDBアクセス
