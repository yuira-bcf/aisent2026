# KyaraInnovate - Claude Code 指示書

## プロジェクト概要

AI搭載オーダーメイド香水C2Cプラットフォーム。
調香師（クリエーター）の感性をAIルール化し、キーワードベースで個別ブレンドを生成・販売する。

- **リポジトリ**: yoshioka/aisent2026
- **構成**: Turborepo モノレポ
- **言語**: 日本語（ドキュメント・コミットメッセージ）、英語（コード・変数名）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) + Turbopack |
| UI | React 19, Tailwind CSS 4 |
| 言語 | TypeScript 5.7 (strict) |
| ORM | Drizzle ORM 0.38 |
| DB | PostgreSQL 16 |
| 認証 | next-auth 5.0.0-beta.25 (Auth.js v5) |
| 決済 | Stripe 20.3.1 (Checkout Sessions) |
| AI | Vercel AI SDK 4 + claude-sonnet-4.5 |
| メール | Resend + React Email |
| テスト | Vitest 3 |
| Lint/Format | Biome 1.9 |
| ビルド | Turborepo 2 |
| インフラ | Docker Compose (dev) → Vercel + クラウド (prod) |

## プロジェクト構成

```
apps/web/              → Next.js アプリ（64ページ, 79 API）
  app/                 → App Router ページ・APIルート
    api/v1/            → REST API エンドポイント
    (auth)/            → 認証画面（login, register等）
    (customer)/        → 顧客画面（blend, shop, history等）
    (creator)/         → クリエーター画面（keywords, recipes等）
    (admin)/           → 管理画面
  components/          → 共有コンポーネント
  lib/                 → ユーティリティ・サービス層
    services/          → ビジネスロジック
    api/               → API共通（auth-guard, rate-limiter等）
    blend/             → 調合計算ロジック
  __tests__/           → Vitest テスト

packages/db/           → Drizzle ORM パッケージ
  src/schema/          → DBスキーマ定義（18ファイル, 40+テーブル）
  src/migrations/      → マイグレーションSQL
  src/seed.ts          → シードデータ

docs/                  → 設計書・進捗管理
  01systemdesign/      → システム設計書（22文書）
    features/          → 機能仕様書（18文書）
  02progressmanagement/→ 進捗ダッシュボード
  03mockups/           → モバイルモックアップ（67画面）

legacy/                → 旧版アーカイブ（参照用）
```

## 開発フェーズ状況

| フェーズ | 状態 | 内容 |
|---------|------|------|
| Phase 1 | **完了** | コア機能（認証・調合・AI連携・クリエーター管理） |
| Phase 2 | **未着手（最優先）** | クリエーター・マーケットプレイス |
| Phase 3 | **EC基盤のみ先行実装済** | コマース（カート・決済・注文は実装済、ロイヤリティ・メール未実装） |
| Phase 4 | 未着手 | パーソナライゼーション |

## 重要なコマンド

```bash
# 開発サーバー
docker compose up db          # PostgreSQL起動
npm run dev                   # Next.js開発サーバー（Turbopack）

# DB操作
npm run db:generate           # Drizzleマイグレーション生成
npm run db:push               # スキーマをDBに適用
npm run db:seed               # シードデータ投入

# 品質チェック
npm run lint                  # Biome lint
npm run check                 # TypeScript型チェック（tsc --noEmit）
npm run test                  # Vitest テスト実行

# ビルド
npm run build                 # プロダクションビルド
```

## 設計書への参照

コード変更時は関連する設計書との整合性を確認すること：

- 要件定義: `docs/01systemdesign/01_要件定義書.md`
- 基本設計: `docs/01systemdesign/02_基本設計書.md`
- 詳細設計: `docs/01systemdesign/03_詳細設計書.md`
- 実装計画: `docs/01systemdesign/06_実装計画書.md`
- 機能仕様: `docs/01systemdesign/features/` 配下
- AI設計: `docs/01systemdesign/hybrid-blend-architecture.md`
- 進捗ログ: `docs/context-log.md`

## コーディング規約

- `.claude/rules/` 配下のルールファイルを参照
- Biome設定に従う（`biome check .` でエラーゼロ）
- `tsc --noEmit` でエラーゼロを維持
- テストは `apps/web/__tests__/` に配置

## 注意事項

- **Git未初期化**: Sprint 0 で初期化予定。コミット時は慎重に
- **C-10保留**: 画像アップロード先はデプロイ環境確定後に決定
- **AI記述の廃止**: 要件書内の「GPT-4」「OpenAI API」は廃止済み。claude-sonnet-4.5 を使用
- **.env.local**: Stripe/OpenAI等のAPIキーはプレースホルダー。本番値は別管理
