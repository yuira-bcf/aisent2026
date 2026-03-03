# 開発スタック

## ランタイム・パッケージ管理

| 項目 | バージョン |
|------|-----------|
| Node.js | v24.2.0 |
| npm | 11.3.0 |
| パッケージマネージャ | npm workspaces |

---

## モノレポ構成

Turborepo によるモノレポ管理。2つのワークスペースで構成。

```
kyarainnovate/
├── apps/
│   └── web/              # @kyarainnovate/web — Next.js アプリケーション
├── packages/
│   └── db/               # @kyarainnovate/db — DB スキーマ・クライアント
├── turbo.json
└── package.json
```

| ツール | バージョン | 用途 |
|-------|-----------|------|
| Turborepo | ^2 | モノレポのタスク実行・キャッシュ管理 |

### Turbo タスク

| コマンド | 内容 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run check` | TypeScript 型チェック (`tsc --noEmit`) |
| `npm run lint` | Biome によるリント |
| `npm run test` | Vitest テスト実行 |
| `npm run db:generate` | Drizzle マイグレーション生成 |
| `npm run db:push` | DB スキーマ反映 |
| `npm run db:seed` | シードデータ投入 |

---

## フロントエンド (`apps/web`)

### フレームワーク

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Next.js | ^15.1 | App Router / Server Components / Turbopack |
| React | ^19.0 | UI ライブラリ |
| React DOM | ^19.0 | DOM レンダリング |
| TypeScript | ^5.7 | 型安全 (strict モード) |

**Next.js 設定:**
- `output: 'standalone'` — Docker デプロイ対応
- `transpilePackages: ['@kyarainnovate/db']` — モノレポパッケージのトランスパイル
- Turbopack 使用（`next dev --turbopack`）

### スタイリング

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Tailwind CSS | ^4 | ユーティリティファースト CSS |
| @tailwindcss/postcss | ^4 | PostCSS 統合 |
| PostCSS | ^8 | CSS 処理パイプライン |

CSS Modules は不使用。全スタイリングは Tailwind クラスをインラインで適用。

### UI コンポーネント

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Recharts | ^2.15 | グラフ描画（PieChart, ScatterChart） |

コンポーネントライブラリ (shadcn/ui 等) は不使用。カスタムコンポーネントで構成。

### 認証

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| NextAuth.js (Auth.js) | ^5.0.0-beta.25 | 認証・セッション管理 |
| bcryptjs | ^2.4 | パスワードハッシュ |

**認証方式:** Credentials プロバイダー（メール + パスワード）、JWT セッション戦略。
**ミドルウェア:** 全ルートで認証チェック。ロールベースアクセス制御 (`CUSTOMER` / `CREATOR` / `ADMIN`)。

### AI 連携

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Vercel AI SDK (`ai`) | ^4 | AI テキスト生成のユニファイドインターフェース |
| @ai-sdk/openai | ^1 | OpenAI プロバイダー |

**用途:** ストーリー生成（GPT-4）、ルール提案。OPENAI_API_KEY 未設定時はフォールバックテキストを返す。

### 決済

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Stripe | ^20.3.1 | 決済処理 |

### バリデーション・計算

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Zod | ^3.24 | スキーマバリデーション |
| Decimal.js | ^10.4 | 精密な小数計算（配合比率） |

---

## データベース (`packages/db`)

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Drizzle ORM | ^0.38 | TypeScript ファーストの ORM |
| Drizzle Kit | ^0.30 | マイグレーション管理・Studio |
| postgres (postgres.js) | ^3.4 | PostgreSQL ドライバ |
| tsx | ^4 | シードスクリプト実行 |

**DB:** PostgreSQL

### スキーマ構成

```
packages/db/src/schema/
├── index.ts        # エクスポートバレル
├── users.ts        # ユーザー・ロール
├── flavors.ts      # 香料マスタ（26種）・ノートタイプ
├── keywords.ts     # キーワード・カテゴリ
├── rules.ts        # キーワード×香料ルール
├── blends.ts       # 調合リクエスト・結果・配合明細
└── commerce.ts     # 商品・カート・注文・住所
```

---

## 開発ツール

### リンター・フォーマッター

| ツール | バージョン | 用途 |
|-------|-----------|------|
| Biome | ^1.9 | リント + フォーマット（ESLint/Prettier の代替） |

### テスト

| ツール | バージョン | 用途 |
|-------|-----------|------|
| Vitest | ^3 | ユニットテスト |

### TypeScript 設定

- `target: ES2017`
- `strict: true`
- `moduleResolution: bundler`
- パスエイリアス: `@/*` → `./*(apps/web 内)`

---

## アプリケーション構成

### ルーティング（App Router）

```
app/
├── page.tsx                              # トップページ
├── (auth)/
│   ├── login/page.tsx                    # ログイン
│   └── register/page.tsx                 # 新規登録
├── (customer)/
│   ├── blend/page.tsx                    # 調合作成
│   ├── result/[id]/page.tsx              # 調合結果（配合チャート + マップ + ストーリー）
│   ├── history/page.tsx                  # 調合履歴
│   ├── shop/page.tsx                     # ショップ
│   ├── cart/page.tsx                     # カート
│   ├── checkout/page.tsx                 # 決済
│   ├── orders/page.tsx                   # 注文一覧
│   ├── orders/[id]/page.tsx              # 注文詳細
│   └── addresses/page.tsx                # 住所管理
├── (creator)/
│   ├── keywords/page.tsx                 # キーワード管理
│   ├── keywords/[id]/page.tsx            # ルール編集
│   └── stats/page.tsx                    # 統計
└── (admin)/
    ├── dashboard/page.tsx                # 管理ダッシュボード
    ├── users/page.tsx                    # ユーザー管理
    └── orders/page.tsx                   # 注文管理
```

### Server Actions

| ファイル | 内容 |
|---------|------|
| `actions/auth.ts` | ログイン・登録・ログアウト |
| `actions/blend.ts` | 調合実行・名前変更 |
| `actions/creator-rules.ts` | ルール CRUD（クリエイター用） |

### コンポーネント

| ファイル | 種別 | 用途 |
|---------|------|------|
| `components/flavor-chart.tsx` | Client | 配合比率 PieChart（ドーナツ） |
| `components/story-display.tsx` | Client | AI ストーリー表示 |
| `components/fragrance-map.tsx` | Client | フレグランスマップ ScatterChart |
| `components/similar-fragrances.tsx` | Client | 類似フレグランス Top 3 カード |

### ロジック

| ファイル | 用途 |
|---------|------|
| `lib/blend-calculator.ts` | 配合計算（加重平均 + ノート正規化、Decimal.js） |
| `lib/blend-service.ts` | 調合ビジネスロジックのオーケストレーション |
| `lib/ai-client.ts` | AI ストーリー生成・ルール提案 |
| `lib/auth.ts` | NextAuth 設定 |
| `lib/db/` | DB クライアント |
| `lib/fragrance-map/` | フレグランスマップ機能（座標・リファレンス・類似度計算） |

---

## 環境変数

| 変数 | 用途 | フェーズ |
|------|------|---------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | 必須 |
| `AUTH_SECRET` | NextAuth シークレット | 必須 |
| `AUTH_URL` | アプリ URL | 必須 |
| `OPENAI_API_KEY` | OpenAI API キー | 任意（未設定時はフォールバック） |
| `AI_SERVICE_URL` | AI サービス URL | Phase 1.5 |
| `INTERNAL_SERVICE_TOKEN` | 内部サービス間トークン | Phase 1.5 |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | Phase 3 |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット | Phase 3 |
| `RESEND_API_KEY` | Resend メール送信 | Phase 3 |

---

*最終更新: 2026年2月14日*
