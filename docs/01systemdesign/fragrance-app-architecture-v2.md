# 香り生成アプリ アーキテクチャ設計書 v2

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [開発スタック](#2-開発スタック)
3. [全体アーキテクチャ](#3-全体アーキテクチャ)
4. [スキーマ拡張設計](#4-スキーマ拡張設計)
5. [事前準備データ定義と蓄積方法](#5-事前準備データ定義と蓄積方法)
6. [調香師向けデータ入力UI](#6-調香師向けデータ入力ui)
7. [Layer 1：ルールエンジン](#7-layer-1ルールエンジン)
8. [Layer 2：配合生成MLモデル](#8-layer-2配合生成mlモデル)
9. [Layer 3：パーソナライズエンジン](#9-layer-3パーソナライズエンジン)
10. [Server Actions](#10-server-actions)
11. [コンポーネント実装](#11-コンポーネント実装)
12. [フレグランスマップ機能](#12-フレグランスマップ機能)
13. [モデル学習パイプライン](#13-モデル学習パイプライン)
14. [インフラ構成](#14-インフラ構成)
15. [データ蓄積タイムライン](#15-データ蓄積タイムライン)
16. [Mecrear AIエージェントへの展開戦略](#16-mecrear-aiエージェントへの展開戦略)

---

## 1. プロジェクト概要

### 1.1 背景

株式会社キャライノベイトが提供するAISCENT（アイセント）の後継として、ユーザーの希望（季節・感覚・フリーワード）からAIが最適なフレグランス配合レシピを生成するアプリケーションを開発する。

### 1.2 設計方針

ルールベース、MLモデル、メタ学習（パーソナライズ）の3層を初期段階からフル実装する。調香師のレシピデータ・香料相性データ等の必要データは、調香師が専用Web UIから直接入力して事前に準備する。LLMへのフォールバックに依存しない自前推論モデルで構築する。

### 1.3 3層複合が必要な理由

| 層 | 単独での限界 | 複合での役割 |
|---|---|---|
| ルールのみ | 「さわやか」等の抽象入力に対応不可。パターン爆発 | 安全制約のGate Keeper。禁止組合せや比率制約の強制 |
| MLモデルのみ | 禁止組合せ等の絶対制約を保証できない | ルールが通した候補から最適配合を予測 |
| メタ学習のみ | ベースとなるレシピがなければ調整対象がない | ユーザー個人の嗜好に合わせた微調整 |

### 1.4 性能目標

| 項目 | 目標値 |
|---|---|
| レシピ生成レイテンシ | 100-300ms（LLM依存時は2-5秒） |
| API呼び出し費用 | ほぼゼロ（自前推論） |
| パーソナライズ精度 | フィードバック5件以上で嗜好反映 |

---

## 2. 開発スタック

### 2.1 既存スタック（kyarainnovate モノレポ）

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| モノレポ管理 | Turborepo | ^2 |
| ランタイム | Node.js | v24.2.0 |
| フレームワーク | Next.js (App Router) | ^15.1 |
| UI | React | ^19.0 |
| 型安全 | TypeScript (strict) | ^5.7 |
| スタイリング | Tailwind CSS | ^4 |
| ORM | Drizzle ORM | ^0.38 |
| DB | PostgreSQL | - |
| 認証 | NextAuth.js (Auth.js) | ^5.0.0-beta.25 |
| AI連携 | Vercel AI SDK + OpenAI | ^4 |
| バリデーション | Zod | ^3.24 |
| 精密計算 | Decimal.js | ^10.4 |
| 決済 | Stripe | ^20.3.1 |
| グラフ | Recharts | ^2.15 |
| リンター | Biome | ^1.9 |
| テスト | Vitest | ^3 |

### 2.2 新規追加（ML推論サービス）

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| ML推論 | Python FastAPI | Layer 2/3 のMLモデル推論 |
| ML学習 | scikit-learn | GradientBoosting, NMF |
| テキスト埋込 | sentence-transformers | フリーワード → 384次元ベクトル |
| 数値計算 | NumPy | 配合比率計算・行列演算 |

### 2.3 段階的ML導入戦略

```
Phase 1: 既存 Vercel AI SDK + ルールエンジンで動作
         → 調香師がデータ入力を進める期間
         
Phase 2: packages/ml/ を追加、ML推論に切り替え
         → データ蓄積完了後
```

---

## 3. 全体アーキテクチャ

### 3.1 3層処理フロー

```
ユーザー入力（季節・感覚・フリーワード）
         │
    ┌────▼────┐
    │ Layer 1  │  ルールエンジン（Gate Keeper）
    │ Next.js  │  - 香料相性の禁止ルール
    │ Server   │  - トップ/ミドル/ラスト比率の基本制約
    │          │  - 季節×感覚 → 香料カテゴリのマッピング
    └────┬────┘
         │ 制約付き候補香料リスト
    ┌────▼────┐
    │ Layer 2  │  MLモデル（配合最適化）
    │ FastAPI  │  - 候補香料から最適な配合比率を予測
    │          │  - 学習データ: 調香師レシピ + ユーザー評価
    │          │  - GradientBoosting（MultiOutput）
    └────┬────┘
         │ 配合レシピ案
    ┌────▼────┐
    │ Layer 3  │  メタモデル（パーソナライズ）
    │ FastAPI  │  - ユーザー履歴から嗜好を学習
    │          │  - NMF（非負値行列分解）による協調フィルタリング
    │          │  - コールドスタートはペルソナマッチングで対応
    └────┬────┘
         │
    最終レシピ出力
```

### 3.2 システム構成

```
┌──────────────────────────────────────────────────────┐
│                  Turborepo モノレポ                     │
│                                                        │
│  apps/web/              Next.js 15 App Router          │
│  ├── (creator)/         調香師向けデータ入力UI           │
│  │   └── data/          各種データ入力画面               │
│  ├── (customer)/        エンドユーザー（調合・履歴等）    │
│  ├── (admin)/           管理画面                        │
│  ├── lib/                                              │
│  │   ├── rule-engine.ts    Layer 1 ルールエンジン       │
│  │   ├── blend-calculator.ts  既存配合計算（拡張）       │
│  │   └── ai-client.ts     AI連携（既存+拡張）          │
│  ├── actions/           Server Actions                  │
│  └── api/ml/            ML推論プロキシ                  │
│                                                        │
│  packages/db/           Drizzle スキーマ                 │
│  ├── schema/            既存 + 拡張テーブル              │
│  └── seed/              シードデータ                    │
│                                                        │
│  packages/ml/           MLサービス（Phase 2で追加）      │
│  └── Python FastAPI     Layer 2/3 推論                  │
│                                                        │
│  ┌──────────────┐  ┌─────────────┐                     │
│  │ PostgreSQL   │  │ FastAPI     │                     │
│  │              │  │ (ML推論)    │                     │
│  └──────────────┘  └─────────────┘                     │
└──────────────────────────────────────────────────────┘
```

### 3.3 既存スキーマとの対応関係

```
既存スキーマ               →  3層アーキテクチャでの役割

flavors.ts（26種香料）     →  ① 香料マスタの拡張
keywords.ts               →  ③ 季節×感覚マッピングの基盤
rules.ts                  →  Layer 1 ルールエンジンの基盤
blends.ts                 →  Layer 2 配合結果の保存先
blend-calculator.ts       →  Layer 2 配合計算の拡張元
(creator) ルート           →  調香師UIの配置先
CREATORロール              →  調香師の認証・認可
```

### 3.4 ルーティング拡張

```
app/
├── page.tsx                                # 既存：トップページ
├── (auth)/                                 # 既存
│   ├── login/page.tsx
│   └── register/page.tsx
├── (customer)/                             # 既存
│   ├── blend/page.tsx
│   ├── result/[id]/page.tsx
│   ├── history/page.tsx
│   ├── shop/page.tsx
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── orders/page.tsx
│   ├── orders/[id]/page.tsx
│   └── addresses/page.tsx
├── (creator)/                              # 既存 + 拡張
│   ├── keywords/page.tsx                   # 既存
│   ├── keywords/[id]/page.tsx              # 既存
│   ├── stats/page.tsx                      # 既存
│   │
│   ├── data/page.tsx                       # 新規：データ入力ダッシュボード
│   ├── data/ingredients/page.tsx           # 新規：Tab1 香料マスタ登録
│   ├── data/prohibited/page.tsx            # 新規：Tab2 禁止組み合わせ
│   ├── data/compatibility/
│   │   ├── page.tsx                        # 新規：Tab3 モード選択
│   │   ├── swipe/page.tsx                  # 新規：Tinder風入力
│   │   ├── matrix/page.tsx                 # 新規：マトリクス入力
│   │   └── review/page.tsx                 # 新規：自動算出レビュー
│   ├── data/recipes/
│   │   ├── page.tsx                        # 新規：Tab4 レシピ一覧
│   │   ├── new/page.tsx                    # 新規：レシピ作成
│   │   └── review/page.tsx                 # 新規：Tab5 合成レシピ評価
│   └── layout.tsx                          # 既存（サイドバー拡張）
└── (admin)/                                # 既存
    ├── dashboard/page.tsx
    ├── users/page.tsx
    └── orders/page.tsx
```

### 3.5 Server Actions 拡張

```
app/actions/
├── auth.ts                   # 既存
├── blend.ts                  # 既存
├── creator-rules.ts          # 既存
│
├── creator-ingredients.ts    # 新規：香料CRUD
├── creator-prohibited.ts     # 新規：禁止ペアCRUD
├── creator-compatibility.ts  # 新規：相性スコアCRUD
├── creator-recipes.ts        # 新規：レシピCRUD + 評価
└── creator-dashboard.ts      # 新規：ダッシュボード集計
```

---

## 4. スキーマ拡張設計

### 4.1 スキーマファイル構成

```
packages/db/src/schema/
├── index.ts              # エクスポートバレル（更新）
├── users.ts              # 既存
├── flavors.ts            # 既存 → 拡張（volatility, intensity, category追加）
├── keywords.ts           # 既存
├── rules.ts              # 既存
├── blends.ts             # 既存
├── commerce.ts           # 既存
├── compatibility.ts      # 新規 ⑤ 香料ペア相性
├── prohibited.ts         # 新規 ② 禁止組み合わせ
├── expert-recipes.ts     # 新規 ④ 調香師レシピ
├── personas.ts           # 新規 ⑥ ペルソナ
└── feedbacks.ts          # 新規 フィードバック・嗜好ベクトル
```

### 4.2 既存 flavors テーブルの拡張

既存スキーマの ID 型は全て `uuid` を使用しているため、新規テーブルも `uuid` で統一する。

```typescript
// packages/db/src/schema/flavors.ts
// 既存カラムに新規カラムを追加（マイグレーションで ALTER TABLE）

import { pgTable, uuid, varchar, decimal, integer,
         boolean, text, timestamp } from 'drizzle-orm/pg-core';

export const flavors = pgTable('flavors', {
  // --- 既存カラム（変更なし） ---
  id: uuid('id').primaryKey().defaultRandom(),
  nameJa: varchar('name_ja', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  noteType: varchar('note_type', { length: 10 }).notNull().$type<NoteType>(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),

  // --- 新規追加カラム ---
  category: varchar('category', { length: 50 }),
  // 'citrus', 'floral_rich', 'green', 'marine', 'wood' 等
  // Layer 1 ルールエンジンの季節×感覚マッピングで使用
  volatility: decimal('volatility', { precision: 3, scale: 2 }),
  // 0.00-1.00 (0=持続性高い, 1=すぐ揮発)
  intensity: decimal('intensity', { precision: 3, scale: 2 }),
  // 0.00-1.00 (0=ほのか, 1=非常に強い)
  isActive: boolean('is_active').default(true),
  // Layer 1 で非アクティブ香料を除外するために使用
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**注意:** `category`, `volatility`, `intensity`, `isActive` は既存スキーマに存在しないカラム。`drizzle-kit generate` → `drizzle-kit push` でマイグレーションを実行する必要がある。これらのカラムが追加されるまで、Layer 1 ルールエンジンは動作しない。

### 4.3 新規テーブル定義

#### 禁止組み合わせ

```typescript
// packages/db/src/schema/prohibited.ts

import { pgTable, uuid, text, varchar, unique } from 'drizzle-orm/pg-core';
import { flavors } from './flavors';

export const prohibitedPairs = pgTable('prohibited_pairs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientAId: uuid('ingredient_a_id')
    .references(() => flavors.id).notNull(),
  ingredientBId: uuid('ingredient_b_id')
    .references(() => flavors.id).notNull(),
  reason: varchar('reason', { length: 50 }).notNull(),
  // 'chemical' | 'unpleasant' | 'cancel_out' | 'other'
  note: text('note'),
}, (table) => ({
  uniquePair: unique().on(table.ingredientAId, table.ingredientBId),
}));
```

#### 香料ペア相性スコア

```typescript
// packages/db/src/schema/compatibility.ts

import { pgTable, uuid, decimal, varchar, text, unique } from 'drizzle-orm/pg-core';
import { flavors } from './flavors';

export const ingredientCompatibility = pgTable('ingredient_compatibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientAId: uuid('ingredient_a_id')
    .references(() => flavors.id).notNull(),
  ingredientBId: uuid('ingredient_b_id')
    .references(() => flavors.id).notNull(),
  score: decimal('score', { precision: 3, scale: 2 }).notNull(),
  // -1.00 ~ 1.00
  source: varchar('source', { length: 20 }).default('manual'),
  // 'manual' | 'computed' | 'reviewed'
  note: text('note'),
}, (table) => ({
  uniquePair: unique().on(table.ingredientAId, table.ingredientBId),
}));
```

#### 調香師レシピ

```typescript
// packages/db/src/schema/expert-recipes.ts

import { pgTable, uuid, varchar, text, integer,
         decimal, timestamp } from 'drizzle-orm/pg-core';
import { flavors } from './flavors';
import { users } from './users';

export const expertRecipes = pgTable('expert_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  season: varchar('season', { length: 10 }).notNull(),
  feeling: varchar('feeling', { length: 20 }).notNull(),
  concept: text('concept').notNull(),
  qualityScore: integer('quality_score').notNull(),
  // 1-5
  source: varchar('source', { length: 20 }).default('manual'),
  // 'manual' | 'synthetic' | 'llm_generated'
  creatorId: uuid('creator_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expertRecipeItems = pgTable('expert_recipe_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .references(() => expertRecipes.id).notNull(),
  ingredientId: uuid('ingredient_id')
    .references(() => flavors.id).notNull(),
  ratio: decimal('ratio', { precision: 5, scale: 2 }).notNull(),
});
```

#### ペルソナ

```typescript
// packages/db/src/schema/personas.ts

import { pgTable, uuid, varchar, text, jsonb,
         timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const personas = pgTable('personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 50 }).unique().notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  preferences: jsonb('preferences').notNull(),
  // { "citrus": 0.9, "green": 0.8, "oriental": -0.3, ... }
  triggerAnswers: jsonb('trigger_answers').notNull(),
  // { "time": "朝", "intensity": "軽い", "mood": "アクティブ" }
});

export const userPersonaAnswers = pgTable('user_persona_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  timePreference: varchar('time_preference', { length: 20 }),
  intensityPreference: varchar('intensity_preference', { length: 20 }),
  moodPreference: varchar('mood_preference', { length: 20 }),
  matchedPersonaId: uuid('matched_persona_id')
    .references(() => personas.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### フィードバック・嗜好ベクトル

```typescript
// packages/db/src/schema/feedbacks.ts

import { pgTable, uuid, integer, text,
         jsonb, timestamp } from 'drizzle-orm/pg-core';
import { blendRequests } from './blends';
import { users } from './users';

export const blendFeedbacks = pgTable('blend_feedbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  blendRequestId: uuid('blend_request_id')
    .references(() => blendRequests.id).notNull(),
  userId: uuid('user_id')
    .references(() => users.id).notNull(),
  rating: integer('rating').notNull(),
  // 1-5
  sweetnessPref: integer('sweetness_pref'),
  // -2 ~ 2
  freshnessPref: integer('freshness_pref'),
  // -2 ~ 2
  intensityPref: integer('intensity_pref'),
  // -2 ~ 2
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userPreferenceVectors = pgTable('user_preference_vectors', {
  userId: uuid('user_id')
    .references(() => users.id).primaryKey(),
  vector: jsonb('vector').notNull(),
  sampleCount: integer('sample_count').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
});
```

### 4.4 ER図概要

```
flavors ──────┬── prohibited_pairs                         [新規]
(既存+拡張)   ├── season_feeling_map (keywords/rules既存活用)
              ├── ingredient_compatibility                 [新規]
              ├── expert_recipes                           [新規]
              │       └── expert_recipe_items               [新規]
              └── blend_requests (既存)
                     └── blend_feedbacks                   [新規]
                              │
users ─────────────────────────┤
(既存)         │               └── user_preference_vectors [新規]
               └── user_persona_answers                    [新規]
                        │
               personas ┘                                  [新規]

※ 全テーブルの PK は uuid 型で統一（既存スキーマと整合）
```

---

## 5. 事前準備データ定義と蓄積方法

### 5.1 データ一覧と調達難易度

```
  簡単  ① 香料マスタ          ← 公開情報 + 調香師知見で構築
   ↑   ③ 季節×感覚マップ      ← 調香理論から導出
   │   ② 禁止組み合わせ       ← 化学データ + 調香師知見
   │   ⑤ 相性スコア           ← アルゴリズム算出 + 調香師レビュー
   │   ⑥ ペルソナ定義         ← マーケティング知見
   ↓   ④ 調香師レシピ300件    ← 調香師が直接UIから入力
  困難
```

### 5.2 各データの蓄積方法

調香師は無料で対応可能。データは未加工のため、Web UIから一つずつ入力する方式を採用。

#### ① 香料マスタ（50-100種）

**入力者：** 調香師
**入力方法：** 管理画面 Tab 1（香料登録フォーム）
**入力内容：** 名前、ノートタイプ、カテゴリ、揮発性（スライダー）、強度（スライダー）、メモ
**補助データ：** 既存 flavors テーブルの26種をベースに拡張。公開情報（高砂香料工業カタログ、The Good Scents Company、Fragrantica）で特徴量を補完。

#### ② 禁止組み合わせ

**入力者：** 調香師
**入力方法：** 管理画面 Tab 2（ペア選択 + 理由選択）
**想定件数：** 20-50件程度
**理由カテゴリ：** 化学的変質 / 不快な香り / 相互打消し / その他

#### ③ 季節×感覚マッピング（24パターン）

**作成方法：** LLMで初期ドラフト生成 → 調香師がレビュー・修正
**入力先：** 既存の keywords / rules スキーマを活用、またはシードデータとして投入

```
4季節 × 6感覚 = 24パターン
各パターンに推奨香料カテゴリを3つずつ定義

例:
  春 × さわやか  → [citrus, green, floral_light]
  夏 × さわやか  → [citrus, marine, mint]
  秋 × 高級     → [amber, sandalwood, leather]
  冬 × まろやか  → [vanilla, cinnamon, musk]
```

#### ④ 調香師レシピ（300件以上）— 最重要

**入力者：** 調香師
**入力方法：** 管理画面 Tab 4（レシピ作成画面）
**入力ペース：** 1日3-5件 → 約2ヶ月で180-300件

**補助的な手段（合成データ生成）：**

- プログラムによる合成レシピ生成（調香理論ベース） → 調香師が Tab 5 で評価（品質スコア3以上のみ採用）
- LLMによるレシピ生成 → 同様に調香師が評価

```
調達目標:
├── 調香師直接入力:     150-200件（メイン）
├── 合成データ(承認済): 50-100件（補助）
├── LLM生成(承認済):    50件程度（補助）
└── 合計: 300件以上（品質スコア3以上）
```

#### ⑤ 香料ペア相性スコア（1,225ペア ※50種の場合）

**蓄積方法：** 3段階のハイブリッド

1. **アルゴリズム自動算出（全ペア）：** カテゴリ間ベース相性 + ノート多様性ボーナス + 強度バランス + 揮発性補完性から自動計算
2. **調香師レビュー（極端値 80-120件）：** 自動算出スコアが 0.8以上 / -0.5以下 のペアを管理画面 Tab 3（レビュー画面）で確認
3. **調香師の空き時間入力：** 管理画面 Tab 3（Tinder風Swipe UI）で1ペア3秒で順次評価

```python
# 自動算出アルゴリズム
def compute_compatibility(ing_a, ing_b, category_compat):
    # ベース: カテゴリ間相性
    base = category_compat.get((ing_a.category, ing_b.category), 0.0)
    # 補正1: 異なるノートタイプは +0.1
    if ing_a.note_type != ing_b.note_type:
        base += 0.1
    # 補正2: 強度が近すぎると -0.05
    if abs(ing_a.intensity - ing_b.intensity) < 0.1:
        base -= 0.05
    # 補正3: 揮発性の差が大きいと +0.05（持続性が良い）
    if abs(ing_a.volatility - ing_b.volatility) > 0.5:
        base += 0.05
    return max(-1.0, min(1.0, base))
```

#### ⑥ ペルソナ別嗜好データ（20-30パターン）

**作成方法：** マーケティング知見 + 香水市場データから構築

```
ペルソナ軸:
├── 時間帯の好み（朝/昼/夜）
├── 香りの強さの好み（軽い/中間/強い）
└── 気分の傾向（アクティブ/リラックス/フォーマル）

3軸 × 3段階 = 27パターン → 類似統合して20-25パターン
```

**初回利用時のアンケート（3-5問）：**

- Q1: 香りをつけるのはいつが多いですか？（朝/昼/夜/特になし）
- Q2: 好みの香りの強さは？（ほのか/程よく/しっかり）
- Q3: 今日の気分に近いのは？（アクティブ/リラックス/特別な日）
- Q4: 好きな空間のイメージは？（海辺/森林/カフェ/花園/バー）〈任意〉
- Q5: 苦手な香りはありますか？（甘い/スパイシー/フローラル/特になし）〈任意〉

---

## 6. 調香師向けデータ入力UI

### 6.1 設計方針

- 調香師はITに詳しくない前提で、スマホでも使える直感的なUIを提供
- 既存の `(creator)/` ルートと CREATOR ロールをそのまま活用（認証・認可の追加開発不要）
- 進捗の可視化とガイド表示でモチベーション維持

### 6.2 画面一覧

| 画面 | パス | 用途 |
|------|------|------|
| データ入力ダッシュボード | `/data` | 全体進捗・統計・次に入力すべきテーマの提案 |
| Tab 1: 香料マスタ登録 | `/data/ingredients` | 香料を1つずつ登録（スライダーUI） |
| Tab 2: 禁止組み合わせ | `/data/prohibited` | 2つの香料を選んで禁止理由を登録 |
| Tab 3: 相性スコア（モード選択） | `/data/compatibility` | 入力モードの選択 |
| Tab 3a: Swipe入力 | `/data/compatibility/swipe` | Tinder風で1ペア3秒評価 |
| Tab 3b: マトリクス入力 | `/data/compatibility/matrix` | カテゴリ×カテゴリのまとめ入力 |
| Tab 3c: 自動算出レビュー | `/data/compatibility/review` | アルゴリズム算出値の確認・修正 |
| Tab 4: レシピ作成 | `/data/recipes/new` | 配合レシピの作成（スライダー+バランスメーター） |
| Tab 5: 合成レシピ評価 | `/data/recipes/review` | 自動生成レシピの品質評価 |

### 6.3 レシピ作成画面（Tab 4）の詳細

調香師が「実際に調香するように」レシピを作成できるUI。

```
┌─────────────────────────────────────────────┐
│  🎨 レシピを作る                    [48/300] │
│                                               │
│  ── テーマ設定 ──                             │
│  季節:  🌸春  ☀️夏  🍂秋  ❄️冬                │
│  感覚:  さわやか / まろやか / ナチュラル        │
│         陽気 / 優雅 / 高級                    │
│  コンセプト（自由記述）                        │
│  [ 夏の朝、海辺で目覚めた瞬間の空気 ]          │
│                                               │
│  ── 香料を選んで配合 ──                       │
│  [+ 香料を追加]                               │
│                                               │
│  ┌─ トップノート (合計: 30%) ──────────────┐ │
│  │ 🍊 レモン         ●━━━━━━━━━○  20%    │ │
│  │ 🍊 ベルガモット    ●━━━━━○━━━○  10%    │ │
│  └──────────────────────────────────────┘ │
│  ┌─ ミドルノート (合計: 45%) ──────────────┐ │
│  │ 🌊 マリンノート    ●━━━━━━━━━○  25%    │ │
│  │ 🌿 ティーツリー    ●━━━━━━━○━○  20%    │ │
│  └──────────────────────────────────────┘ │
│  ┌─ ラストノート (合計: 25%) ──────────────┐ │
│  │ 🪵 シダーウッド    ●━━━━━━○━━○  15%    │ │
│  │ 🪶 ムスク         ●━━━━○━━━━○  10%    │ │
│  └──────────────────────────────────────┘ │
│                                               │
│  ── バランスメーター ──                       │
│  トップ  ████████░░░░░░░░░░░░ 30% ✅         │
│  ミドル  ████████████████░░░░ 45% ✅         │
│  ラスト  ██████████░░░░░░░░░░ 25% ✅         │
│  合計   ████████████████████ 100% ✅         │
│                                               │
│  品質スコア（自己評価）  ★★★★☆ (4/5)         │
│                                               │
│  [ 下書き保存 ]    [ レシピを登録する ✓ ]      │
└─────────────────────────────────────────────┘

アシスト機能:
├── 比率合計が100%でなければ警告
├── 禁止組み合わせの香料を選んだら即アラート
├── ノート比率が制約範囲外なら黄色表示
├── 相性スコアが低いペアがあれば注意表示
├── カテゴリフィルタ付きドロップダウンで香料追加
├── 前回のレシピをコピーして微調整する機能
└── ダッシュボードに「次に作成をお願いしたいテーマ」を表示
```

### 6.4 相性スコアSwipe入力（Tab 3a）の詳細

```
┌─────────────────────────────────────────────┐
│  💫 この2つの相性は？        [142/1225]       │
│  ████████░░░░░░░░░░░░ 12%                    │
│                                               │
│  ┌──────────┐    ┌──────────┐               │
│  │  🍊       │    │  🌹       │               │
│  │  レモン   │    │  ローズ   │               │
│  │  top      │    │  middle   │               │
│  │  柑橘系   │    │ フローラル │               │
│  └──────────┘    └──────────┘               │
│                                               │
│  😫 ━━━━━━━━━━●━━━━━━━━━ 😍              │
│       -1.0         0         1.0              │
│                                               │
│  [ スキップ → ]        [ 次へ ✓ ]             │
│                                               │
│  今日の入力: 47件                              │
└─────────────────────────────────────────────┘
```

### 6.5 ダッシュボード

```
┌─────────────────────────────────────────────┐
│  📊 データ入力ダッシュボード                    │
│                                               │
│  ── 全体進捗 ──                               │
│  ① 香料マスタ     ████████████████████ 50/50  │
│  ② 禁止ペア       ████████████████░░░░ 32/40  │
│  ③ 季節×感覚      ████████████████████ 24/24  │
│  ④ レシピ作成     ████████░░░░░░░░░░░ 127/300 │
│  ⑤ 相性スコア     ██████░░░░░░░░░░░░░ 412/1225│
│  ⑥ ペルソナ       ████████████████████ 25/25  │
│                                               │
│  ── レシピ カバレッジ（不足テーマ優先表示）──   │
│  ⚠️ 冬×さわやか: 2件 → あと8件お願いします     │
│  ⚠️ 夏×高級: 0件 → あと10件お願いします        │
└─────────────────────────────────────────────┘
```

---

## 7. Layer 1：ルールエンジン

Next.js の Server 側ロジック（`lib/rule-engine.ts`）として実装。

```typescript
// apps/web/lib/rule-engine.ts

import { db } from '@kyarainnovate/db';
import { flavors, prohibitedPairs } from '@kyarainnovate/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

type FilteredResult = {
  candidates: typeof flavors.$inferSelect[];
  candidateIds: string[];   // uuid
  candidateFeatures: number[][];
  constraints: {
    topRatio: [number, number];
    middleRatio: [number, number];
    lastRatio: [number, number];
    maxIngredients: number;
  };
  context: {
    season: string;
    feeling: string;
    freeword: string | null;
  };
};

const SEASON_FEELING_MAP: Record<string, Record<string, string[]>> = {
  '春': {
    'さわやか':   ['citrus', 'green', 'floral_light'],
    'まろやか':   ['floral_rich', 'powder', 'musk'],
    'ナチュラル': ['green', 'herbal', 'wood_light'],
    '陽気':       ['citrus', 'fruity', 'floral_light'],
    '優雅':       ['floral_rich', 'rose', 'musk'],
    '高級':       ['rose', 'jasmine', 'sandalwood'],
  },
  '夏': {
    'さわやか':   ['citrus', 'marine', 'mint'],
    'まろやか':   ['coconut', 'vanilla_light', 'floral_light'],
    'ナチュラル': ['green', 'herbal', 'aqua'],
    '陽気':       ['citrus', 'tropical', 'fruity'],
    '優雅':       ['jasmine', 'ylang', 'marine'],
    '高級':       ['neroli', 'tuberose', 'vetiver'],
  },
  '秋': {
    'さわやか':   ['citrus', 'green', 'apple'],
    'まろやか':   ['cinnamon', 'vanilla', 'amber'],
    'ナチュラル': ['wood', 'moss', 'herbal'],
    '陽気':       ['fruity', 'spice_light', 'citrus'],
    '優雅':       ['rose', 'patchouli', 'amber'],
    '高級':       ['oud', 'leather', 'sandalwood'],
  },
  '冬': {
    'さわやか':   ['mint', 'eucalyptus', 'citrus'],
    'まろやか':   ['vanilla', 'cinnamon', 'musk'],
    'ナチュラル': ['cedar', 'pine', 'moss'],
    '陽気':       ['spice', 'citrus', 'ginger'],
    '優雅':       ['iris', 'violet', 'cashmere'],
    '高級':       ['oud', 'amber', 'incense'],
  },
};

export async function filterCandidates(
  season: string,
  feeling: string,
  freeword: string | null = null
): Promise<FilteredResult> {
  // Step 1: 季節×感覚 → 推奨カテゴリ
  const categories = SEASON_FEELING_MAP[season]?.[feeling]
    ?? ['floral_light', 'citrus'];

  // Step 2: カテゴリに属するアクティブ香料を取得
  const allFlavors = await db.select()
    .from(flavors)
    .where(eq(flavors.isActive, true));

  let candidates = allFlavors.filter(
    f => f.category && categories.includes(f.category)
  );

  // Step 3: 各ノートタイプが最低2種あることを保証
  for (const noteType of ['top', 'middle', 'last']) {
    const noteCount = candidates.filter(c => c.noteType === noteType).length;
    if (noteCount < 2) {
      const supplements = allFlavors.filter(
        f => f.noteType === noteType
          && !candidates.some(c => c.id === f.id)
      ).slice(0, 2 - noteCount);
      candidates = [...candidates, ...supplements];
    }
  }

  // Step 4: 禁止組み合わせのチェック情報を取得
  const candidateIds = candidates.map(c => c.id);
  const prohibited = await db.select()
    .from(prohibitedPairs)
    .where(
      and(
        inArray(prohibitedPairs.ingredientAId, candidateIds),
        inArray(prohibitedPairs.ingredientBId, candidateIds),
      )
    );

  // 禁止ペアの低優先側を除外
  for (const pair of prohibited) {
    // 強度が低い方を除外（同等なら後からのIDを除外）
    const a = candidates.find(c => c.id === pair.ingredientAId);
    const b = candidates.find(c => c.id === pair.ingredientBId);
    if (a && b) {
      const removeId = Number(a.intensity ?? 0) < Number(b.intensity ?? 0)
        ? a.id : b.id;
      candidates = candidates.filter(c => c.id !== removeId);
    }
  }

  return {
    candidates,
    candidateIds: candidates.map(c => c.id),
    candidateFeatures: candidates.map(c => [
      Number(c.volatility ?? 0.5),
      Number(c.intensity ?? 0.5),
    ]),
    constraints: {
      topRatio: [0.20, 0.35],
      middleRatio: [0.30, 0.50],
      lastRatio: [0.20, 0.35],
      maxIngredients: 6,
    },
    context: { season, feeling, freeword },
  };
}
```

---

## 8. Layer 2：配合生成MLモデル

### 8.1 モデル設計

```python
# packages/ml/app/models/blend_model.py

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from dataclasses import dataclass

@dataclass
class BlendInput:
    candidate_ids: list[int]
    candidate_features: np.ndarray      # 各香料の特徴量
    season_encoded: np.ndarray          # 季節 one-hot (4,)
    feeling_encoded: np.ndarray         # 感覚 one-hot (6,)
    freeword_embedding: np.ndarray      # フリーワード埋込 (384,)
    constraints: dict

class BlendModel:
    def __init__(self):
        self.model = MultiOutputRegressor(
            GradientBoostingRegressor(
                n_estimators=200, max_depth=5, learning_rate=0.1
            )
        )
        self.compatibility_matrix = None

    def train(self, recipes_df):
        X = recipes_df[self.feature_columns].values
        y = recipes_df[self.ingredient_columns].values
        self.model.fit(X, y)

    def predict(self, blend_input: BlendInput) -> dict:
        features = np.concatenate([
            blend_input.season_encoded,
            blend_input.feeling_encoded,
            blend_input.freeword_embedding,
            blend_input.candidate_features.mean(axis=0),
        ]).reshape(1, -1)

        raw_ratios = self.model.predict(features)[0]

        mask = np.zeros_like(raw_ratios)
        for idx in blend_input.candidate_ids:
            mask[idx] = 1
        raw_ratios *= mask

        ratios = self._apply_constraints(raw_ratios, blend_input.constraints)
        ratios = self._adjust_by_compatibility(ratios, blend_input.candidate_ids)

        return self._format_output(ratios, blend_input)

    def _apply_constraints(self, ratios, constraints):
        ratios = np.maximum(ratios, 0)
        for note_type, (min_r, max_r) in [
            ('top', constraints['top_ratio']),
            ('middle', constraints['middle_ratio']),
            ('last', constraints['last_ratio']),
        ]:
            note_indices = self.note_type_indices[note_type]
            note_sum = ratios[note_indices].sum()
            total = ratios.sum() or 1
            current = note_sum / total
            if current < min_r:
                ratios[note_indices] *= min_r / (current or 0.01)
            elif current > max_r:
                ratios[note_indices] *= max_r / current
        return (ratios / ratios.sum()) * 100

    def _adjust_by_compatibility(self, ratios, candidate_ids):
        active = [(i, ratios[i]) for i in candidate_ids if ratios[i] > 0]
        for i, _ in active:
            compat_score = sum(
                self.compatibility_matrix[i][j] * ratio_j
                for j, ratio_j in active if i != j
            )
            ratios[i] *= np.clip(1.0 + compat_score * 0.05, 0.9, 1.1)
        return (ratios / ratios.sum()) * 100
```

### 8.2 フリーワード埋め込み

```python
# packages/ml/app/services/text_embedder.py

from sentence_transformers import SentenceTransformer
import numpy as np

class FragranceTextEmbedder:
    def __init__(self):
        self.model = SentenceTransformer('intfloat/multilingual-e5-small')
        # 384次元、日本語対応

    def embed(self, freeword: str | None) -> np.ndarray:
        if not freeword:
            return np.zeros(384)
        return self.model.encode(freeword)
```

---

## 9. Layer 3：パーソナライズエンジン

```python
# packages/ml/app/models/personalize_model.py

import numpy as np
from sklearn.decomposition import NMF

class PersonalizeModel:
    def __init__(self):
        self.nmf = NMF(n_components=10, max_iter=300)
        self.user_factors = None
        self.item_factors = None

    def train(self, feedback_matrix: np.ndarray):
        self.user_factors = self.nmf.fit_transform(feedback_matrix)
        self.item_factors = self.nmf.components_.T

    def adjust_recipe(self, recipe: dict, user_id: int,
                      feedback_history: list) -> dict:
        if len(feedback_history) == 0:
            return self._cold_start_adjust(recipe, user_id)

        user_vec = self.user_factors[user_id]
        scores = user_vec @ self.item_factors.T

        adjusted = {}
        for item in recipe['recipe']:
            ing_id = item['ingredient_id']
            delta = np.clip(scores[ing_id] * 5, -10, 10)
            adjusted[ing_id] = max(item['ratio'] + delta, 0)

        total = sum(adjusted.values())
        recipe['recipe'] = [
            {**item, 'ratio': round(adjusted[item['ingredient_id']] / total * 100, 1)}
            for item in recipe['recipe']
            if adjusted[item['ingredient_id']] > 0
        ]
        return recipe

    def _cold_start_adjust(self, recipe: dict, user_id: int) -> dict:
        persona = self._match_persona(user_id)
        if persona:
            return self._apply_persona_preference(recipe, persona, strength=0.5)
        return recipe
```

---

## 10. Server Actions

### 10.1 レシピ作成

```typescript
// app/actions/creator-recipes.ts

'use server';

import { db } from '@kyarainnovate/db';
import { expertRecipes, expertRecipeItems,
         prohibitedPairs } from '@kyarainnovate/db/schema';
import { and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import Decimal from 'decimal.js';

const createRecipeSchema = z.object({
  season: z.enum(['春', '夏', '秋', '冬']),
  feeling: z.enum([
    'さわやか', 'まろやか', 'ナチュラル', '陽気', '優雅', '高級',
  ]),
  concept: z.string().min(1).max(500),
  qualityScore: z.number().int().min(1).max(5),
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    ratio: z.number().min(1).max(80),
  })).min(3).max(8),
});

export async function createExpertRecipe(
  formData: z.infer<typeof createRecipeSchema>
) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'CREATOR') {
    throw new Error('Unauthorized');
  }

  const validated = createRecipeSchema.parse(formData);

  // 合計100%チェック（Decimal.jsで精密計算）
  const total = validated.items.reduce(
    (sum, item) => new Decimal(sum).plus(item.ratio),
    new Decimal(0)
  );
  if (total.minus(100).abs().greaterThan(0.5)) {
    throw new Error('配合比率の合計が100%になるように調整してください');
  }

  // 禁止ペアチェック
  const ids = validated.items.map(i => i.ingredientId);
  const conflicts = await db.select()
    .from(prohibitedPairs)
    .where(and(
      inArray(prohibitedPairs.ingredientAId, ids),
      inArray(prohibitedPairs.ingredientBId, ids),
    ));
  if (conflicts.length > 0) {
    throw new Error('禁止されている組み合わせが含まれています');
  }

  // トランザクションで保存
  await db.transaction(async (tx) => {
    const [recipe] = await tx.insert(expertRecipes).values({
      season: validated.season,
      feeling: validated.feeling,
      concept: validated.concept,
      qualityScore: validated.qualityScore,
      source: 'manual',
      creatorId: session.user.id,  // uuid
    }).returning();

    await tx.insert(expertRecipeItems).values(
      validated.items.map(item => ({
        recipeId: recipe.id,
        ingredientId: item.ingredientId,
        ratio: String(item.ratio),
      }))
    );
  });

  revalidatePath('/data/recipes');
  return { success: true };
}
```

### 10.2 相性スコア登録

```typescript
// app/actions/creator-compatibility.ts

'use server';

import { db } from '@kyarainnovate/db';
import { ingredientCompatibility } from '@kyarainnovate/db/schema';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';

const compatibilitySchema = z.object({
  ingredientAId: z.string().uuid(),
  ingredientBId: z.string().uuid(),
  score: z.number().min(-1).max(1).multipleOf(0.1),
});

export async function submitCompatibility(
  data: z.infer<typeof compatibilitySchema>
) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'CREATOR') {
    throw new Error('Unauthorized');
  }

  // IDの辞書順で小さい方をAに統一（重複防止）
  const [aId, bId] = data.ingredientAId < data.ingredientBId
    ? [data.ingredientAId, data.ingredientBId]
    : [data.ingredientBId, data.ingredientAId];

  await db.insert(ingredientCompatibility).values({
    ingredientAId: aId,
    ingredientBId: bId,
    score: String(data.score),
    source: 'manual',
  }).onConflictDoUpdate({
    target: [
      ingredientCompatibility.ingredientAId,
      ingredientCompatibility.ingredientBId,
    ],
    set: { score: String(data.score), source: 'reviewed' },
  });

  return { success: true };
}

export async function getNextCompatibilityPair() {
  const result = await db.execute(sql`
    SELECT a.id as a_id, a.name as a_name, a.note_type as a_note,
           a.category as a_category,
           b.id as b_id, b.name as b_name, b.note_type as b_note,
           b.category as b_category
    FROM flavors a
    CROSS JOIN flavors b
    WHERE a.id < b.id
      AND a.is_active = true AND b.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM ingredient_compatibility ic
        WHERE ic.ingredient_a_id = a.id AND ic.ingredient_b_id = b.id
      )
    ORDER BY random() LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function getCompatibilityProgress() {
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM ingredient_compatibility) as done,
      (SELECT count(*) FROM flavors a CROSS JOIN flavors b
       WHERE a.id < b.id AND a.is_active = true AND b.is_active = true
      ) as total
  `).then(r => r.rows);
  return { done: Number(stats.done), total: Number(stats.total) };
}
```

### 10.3 ダッシュボード集計

```typescript
// app/actions/creator-dashboard.ts

'use server';

import { db } from '@kyarainnovate/db';
import { sql } from 'drizzle-orm';

export async function getDashboardStats() {
  const [stats] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM flavors WHERE is_active = true) as ingredients,
      (SELECT count(*) FROM prohibited_pairs) as prohibited,
      (SELECT count(*) FROM ingredient_compatibility) as compatibility,
      (SELECT count(*) FROM flavors a CROSS JOIN flavors b
       WHERE a.id < b.id AND a.is_active = true AND b.is_active = true
      ) as compatibility_total,
      (SELECT count(*) FROM expert_recipes) as recipes
  `).then(r => r.rows);

  return {
    ingredients: Number(stats.ingredients),
    prohibited: Number(stats.prohibited),
    compatibility: Number(stats.compatibility),
    compatibilityTotal: Number(stats.compatibility_total),
    recipes: Number(stats.recipes),
    recipesTarget: 300,
  };
}

export async function getRecipeCoverage() {
  return await db.execute(sql`
    SELECT season, feeling, count(*) as count
    FROM expert_recipes
    GROUP BY season, feeling ORDER BY season, feeling
  `).then(r => r.rows);
}

export async function getSuggestions() {
  const TARGET = 10;
  const coverage = await getRecipeCoverage();
  const seasons = ['春', '夏', '秋', '冬'];
  const feelings = ['さわやか', 'まろやか', 'ナチュラル', '陽気', '優雅', '高級'];

  const suggestions = [];
  for (const season of seasons) {
    for (const feeling of feelings) {
      const found = coverage.find(
        (r: any) => r.season === season && r.feeling === feeling
      );
      const count = found ? Number((found as any).count) : 0;
      if (count < TARGET) {
        suggestions.push({
          season, feeling, current: count, needed: TARGET - count,
        });
      }
    }
  }
  return suggestions.sort((a, b) => b.needed - a.needed);
}
```

---

## 11. コンポーネント実装

### 11.1 レシピ作成 Client Component

```tsx
// app/(creator)/data/recipes/new/recipe-creator.tsx
'use client';

import { useState, useCallback, useTransition } from 'react';
import { createExpertRecipe } from '@/actions/creator-recipes';
import Decimal from 'decimal.js';

// 定数
const SEASONS = ['春', '夏', '秋', '冬'] as const;
const SEASON_ICONS = { '春': '🌸', '夏': '☀️', '秋': '🍂', '冬': '❄️' };
const FEELINGS = [
  'さわやか', 'まろやか', 'ナチュラル', '陽気', '優雅', '高級',
] as const;
const NOTE_LABELS = {
  top: { label: 'トップノート', desc: '最初に香る・軽い' },
  middle: { label: 'ミドルノート', desc: '中盤に香る・華やか' },
  last: { label: 'ラストノート', desc: '後半に残る・重い' },
};

// 主要ロジック:
// - 季節・感覚の選択（ボタンタップ）
// - 香料追加時に禁止ペアをクライアント側でチェック
// - スライダーで配合比率を調整
// - ノートバランスメーター（リアルタイム計算、Decimal.js使用）
// - 合計100%・品質スコア入力を送信条件に設定
// - Server Action (createExpertRecipe) でバリデーション + DB保存
```

### 11.2 相性スコアSwipe Client Component

```tsx
// app/(creator)/data/compatibility/swipe/swipe-client.tsx
'use client';

import { useState, useTransition } from 'react';
import {
  submitCompatibility,
  getNextCompatibilityPair,
  getCompatibilityProgress,
} from '@/actions/creator-compatibility';

// 主要ロジック:
// - ランダムに未評価ペアを1つ表示
// - スライダーで -1.0 ~ 1.0 のスコアを入力
// - 送信後に次のペアを自動ロード
// - 進捗バーと今日の入力件数を表示
// - スキップ機能（判断が難しいペアは飛ばせる）
```

---

## 12. フレグランスマップ機能

**ステータス:** 実装済み

### 12.1 背景・目的

旧アプリのレビューにより、ユーザーが作成した香りと実際のイメージが異なるという課題が判明した。ユーザーに「近い香りのイメージ」を伝えるため、実在する有名フレグランスのリファレンスデータベースを構築し、ユーザーの調合結果が香りの世界のどこに位置するかを2D散布図で可視化する機能を追加した。

### 12.2 設計方針

| 項目 | 方針 | 選定理由 |
|------|------|----------|
| 座標軸 | セマンティック軸（手動定義）「フレッシュ ←→ ウォーム」×「ウッディ ←→ フローラル」 | ユーザーに直感的。リファレンス増減で軸の意味が変わらない（PCAの欠点を回避） |
| リファレンスデータ | TypeScript定数としてハードコード（25種） | 頻繁に変わらないデータ。マイグレーション不要でシンプル。クライアントサイド完結で高速 |
| 類似度計算 | コサイン類似度（26次元配合ベクトル） | スパースベクトルに強い。配合パターンの類似性比較に最適 |
| 可視化 | Recharts ScatterChart | プロジェクト既存のRechartsを活用。追加ライブラリ不要 |

### 12.3 座標系

26香料それぞれにセマンティック座標 `{ x, y }` を手動定義。

```
x軸: フレッシュ(-1) ←→ ウォーム(+1)
y軸: ウッディ(-1)  ←→ フローラル(+1)
```

4象限の意味:

```
            フローラル (+y)
                │
  フレッシュ×フローラル │ ウォーム×フローラル
   (ミュゲ, ラベンダー)  │  (ジャスミン, チュベローズ)
                │
 ─────────────┼───────────── x
                │
  フレッシュ×ウッディ   │ ウォーム×ウッディ
   (ライム, シーブルー)  │  (サンダルウッド, レザー)
                │
            ウッディ (-y)
```

ユーザーの配合結果は、各香料の配合比率を重みとした加重平均でマップ座標を算出する。

### 12.4 リファレンスフレグランス

25種の有名フレグランスをマップ上で広い領域をカバーするよう各カテゴリから均等に選出。

| 領域 | フレグランス | 数 |
|------|------------|---|
| フレッシュ・シトラス | Acqua di Gio, CK One, Light Blue, Eau de Cologne Imperiale | 4 |
| フレッシュ・フローラル | Daisy, Chance Eau Fraiche, Miss Dior Blooming Bouquet | 3 |
| フローラル中心 | Chanel No.5, J'adore, Flowerbomb, Chloe EDP | 4 |
| ウォーム・フローラル | Black Opium, La Vie Est Belle, Mon Paris | 3 |
| ウッディ・フレッシュ | Terre d'Hermes, Bleu de Chanel, Sauvage | 3 |
| ウッディ・ウォーム | Tom Ford Oud Wood, Bvlgari Man in Black | 2 |
| オリエンタル | Shalimar, Opium, Angel | 3 |
| バランス型 | L'Eau d'Issey, Le Male | 3 |

各フレグランスは26香料への近似配合ベクトル（合計1.0）と事前計算済みマップ座標を保持する。

### 12.5 類似度計算

コサイン類似度により、ユーザーの26次元配合ベクトルと各リファレンスフレグランスの配合ベクトルを比較し、Top 3を表示する。

```
similarity(A, B) = (A · B) / (|A| × |B|)
```

全てクライアントサイドで計算可能（サーバーAPI不要）。

### 12.6 UI構成

調合結果ページ（`/result/[id]`）の既存コンテンツ（配合比率 + 円グラフ + ストーリー）の下に2つのセクションを追加。

```
┌─────────────────────────────────────────────┐
│  調合結果（既存）                              │
│  ┌──────────────┐ ┌──────────────────────┐   │
│  │ 配合比率      │ │ 配合チャート（円グラフ）│   │
│  │ TOP / MID / LAST│ │                     │   │
│  └──────────────┘ │ ストーリー            │   │
│                    └──────────────────────┘   │
├─────────────────────────────────────────────┤
│  フレグランスマップ（実装済み）                  │
│  ┌─────────────────────────────────────────┐ │
│  │          ScatterChart                    │ │
│  │  ○ リファレンス（グレー）                  │ │
│  │  △ 類似Top3（ピンク三角）                 │ │
│  │  ★ ユーザーの香り（黒い星）               │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  あなたの香りに近いフレグランス（実装済み）       │
│  #1  シャネル No.5         類似度 87% ████░░  │
│  #2  ジャドール            類似度 82% ████░░  │
│  #3  クロエ EDP            類似度 76% ███░░░  │
└─────────────────────────────────────────────┘
```

### 12.7 ファイル構成

```
apps/web/
├── lib/fragrance-map/
│   ├── types.ts                 # 型定義（FlavorCoordinate, ReferenceFragrance, SimilarResult, MapPosition）
│   ├── flavor-coordinates.ts    # 26香料のx,y座標定義
│   ├── reference-fragrances.ts  # 25種リファレンスデータ + 座標事前計算
│   └── similarity.ts            # calculatePosition, cosineSimilarity, findSimilarFragrances
├── components/
│   ├── fragrance-map.tsx        # ScatterChart散布図（Client Component）
│   └── similar-fragrances.tsx   # 類似Top3カード（Client Component）
└── app/(customer)/result/[id]/
    └── page.tsx                 # 既存ページにマップセクション統合
```

### 12.8 3層アーキテクチャとの関係

フレグランスマップは3層パイプライン（ルール → ML → パーソナライズ）とは独立した**表示レイヤー**の機能である。配合結果が確定した後に、その結果を可視化・説明するために動作する。

```
Layer 1 → Layer 2 → Layer 3 → 配合結果確定
                                    │
                              ┌─────▼─────┐
                              │ フレグランス │  ← 表示レイヤー（クライアントサイド）
                              │ マップ機能  │
                              └───────────┘
```

将来的にLayer 2/3が実装された場合も、フレグランスマップはそのまま機能する。配合結果のベクトルを入力として受け取るだけであり、配合がどのように生成されたかには依存しない。

---

## 13. モデル学習パイプライン

### 12.1 初期学習

```python
# packages/ml/scripts/initial_train.py

async def initial_train():
    """デプロイ前に実行する初回モデル学習"""

    # Layer 2: 配合モデル
    expert_recipes = await fetch_expert_recipes(min_quality=3)
    df = prepare_blend_training_data(expert_recipes)
    blend_model = BlendModel()
    blend_model.train(df)
    blend_model.save("models/blend_v1.pkl")

    # Layer 3: パーソナライズモデル
    seed_matrix = generate_seed_matrix_from_personas(PERSONAS)
    personalize_model = PersonalizeModel()
    personalize_model.train(seed_matrix)
    personalize_model.save("models/personalize_v1.pkl")
```

### 12.2 定期再学習（週次）

```python
# packages/ml/scripts/retrain_models.py

async def retrain_blend_model():
    """ユーザーデータ蓄積後の再学習"""
    recipes = await fetch_recipes_with_feedback(min_rating=3.5)
    df = prepare_training_data(recipes)
    model = BlendModel()
    model.train(df)
    metrics = model.evaluate(test_df)
    if metrics['mae'] < current_metrics['mae']:
        model.save(f"models/blend_{datetime.now():%Y%m%d}.pkl")

async def retrain_personalize_model():
    feedbacks = await fetch_user_feedback_matrix()
    model = PersonalizeModel()
    model.train(feedbacks)
    model.save(f"models/personalize_{datetime.now():%Y%m%d}.pkl")
```

---

## 14. インフラ構成

### 14.1 Docker Compose

```yaml
version: '3.8'

services:
  # Next.js アプリケーション
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://fragrance:${DB_PASSWORD}@postgres:5432/fragrance_app
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_URL=http://localhost:3000
      - AI_SERVICE_URL=http://ml-api:8001
    depends_on:
      - postgres

  # ML推論サービス（Phase 2で追加）
  ml-api:
    build: ./packages/ml
    ports:
      - "8001:8001"
    volumes:
      - ./models:/app/models
    depends_on:
      - postgres

  # PostgreSQL
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: fragrance_app
      POSTGRES_USER: fragrance
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 14.2 ディレクトリ構成（完成形）

```
kyarainnovate/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/              # 既存
│       │   ├── (customer)/          # 既存
│       │   ├── (creator)/
│       │   │   ├── keywords/        # 既存
│       │   │   ├── stats/           # 既存
│       │   │   └── data/            # 新規: データ入力UI
│       │   │       ├── page.tsx
│       │   │       ├── ingredients/
│       │   │       ├── prohibited/
│       │   │       ├── compatibility/
│       │   │       │   ├── swipe/
│       │   │       │   ├── matrix/
│       │   │       │   └── review/
│       │   │       └── recipes/
│       │   │           ├── new/
│       │   │           └── review/
│       │   └── (admin)/             # 既存
│       ├── actions/
│       │   ├── auth.ts              # 既存
│       │   ├── blend.ts             # 既存
│       │   ├── creator-rules.ts     # 既存
│       │   ├── creator-ingredients.ts  # 新規
│       │   ├── creator-prohibited.ts   # 新規
│       │   ├── creator-compatibility.ts # 新規
│       │   ├── creator-recipes.ts      # 新規
│       │   └── creator-dashboard.ts    # 新規
│       ├── lib/
│       │   ├── rule-engine.ts       # 新規: Layer 1
│       │   ├── blend-calculator.ts  # 既存（拡張）
│       │   ├── blend-service.ts     # 既存（拡張）
│       │   ├── ai-client.ts        # 既存（拡張）
│       │   ├── auth.ts             # 既存
│       │   └── fragrance-map/      # 実装済み
│       │       ├── types.ts
│       │       ├── flavor-coordinates.ts
│       │       ├── reference-fragrances.ts
│       │       └── similarity.ts
│       └── components/
│           ├── flavor-chart.tsx     # 既存
│           ├── story-display.tsx    # 既存
│           ├── fragrance-map.tsx    # 実装済み
│           └── similar-fragrances.tsx # 実装済み
├── packages/
│   ├── db/
│   │   └── src/schema/
│   │       ├── index.ts            # 更新
│   │       ├── users.ts            # 既存
│   │       ├── flavors.ts          # 既存→拡張
│   │       ├── keywords.ts         # 既存
│   │       ├── rules.ts            # 既存
│   │       ├── blends.ts           # 既存
│   │       ├── commerce.ts         # 既存
│   │       ├── compatibility.ts    # 新規
│   │       ├── prohibited.ts       # 新規
│   │       ├── expert-recipes.ts   # 新規
│   │       ├── personas.ts         # 新規
│   │       └── feedbacks.ts        # 新規
│   └── ml/                         # 新規: Phase 2
│       ├── app/
│       │   ├── models/
│       │   │   ├── blend_model.py
│       │   │   └── personalize_model.py
│       │   └── services/
│       │       └── text_embedder.py
│       ├── scripts/
│       │   ├── initial_train.py
│       │   └── retrain_models.py
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── models/                          # 学習済みモデル
├── turbo.json
├── docker-compose.yml
└── package.json
```

---

## 15. データ蓄積タイムライン

### 15.1 入力スケジュール

```
Week 1-2:  管理画面（データ入力UI）の開発
           調香師への説明・トレーニング

Week 3:    調香師が Tab 1（香料マスタ登録）開始
           並行: 季節×感覚マッピングをLLM初稿→調香師レビュー

Week 4-5:  Tab 2（禁止ペア登録）
           Tab 3（相性スコア自動算出→レビュー開始）
           Tab 4（レシピ作成）開始

Week 6-9:  レシピ作成の本格稼働（1日3-5件ペース）
           合成レシピ生成 → Tab 5（評価）並行
           相性スコアの Swipe 入力を空き時間に

Week 10:   データ品質チェック・統合
           初期モデル学習（packages/ml/scripts/initial_train.py）
           精度検証・調整

Week 11-:  本体アプリの3層パイプライン統合・テスト
```

### 15.2 調香師の日次目標

```
レシピ作成:   3-5件/日 → 2ヶ月で180-300件
相性スコア:   20-30件/日 → 2ヶ月で1,200件
所要時間:     30-60分/日

ガイド機能:
├── ダッシュボードに「今日のおすすめテーマ」表示
├── 「あと○件で目標達成」の進捗バー
└── 不足テーマの自動提案
```

### 15.3 コスト

```
調香師委託費:                ¥0（無料対応）
管理画面開発:                開発工数のみ
LLM API費用（合成データ）:   ¥1-2万
合計:                       ¥1-2万 + 開発工数
```

---

## 16. Mecrear AIエージェントへの展開戦略

### 16.1 共通パターン

```
【香り生成アプリ】               【Mecrear AI分析】

Layer 1 ルール                   Layer 1 ルール
  香料相性・禁止組合せ        →    医療ガイドライン・禁忌

Layer 2 MLモデル                 Layer 2 MLモデル
  配合比率の最適化            →    治療効果の予測・分析

Layer 3 メタ学習                 Layer 3 メタ学習
  ユーザーの嗜好学習          →    患者個人の傾向学習

入力: 季節+感覚+キーワード   →  入力: 症状+検査値+既往歴
出力: 香料レシピ              →  出力: 治療提案・リスク分析
```

### 16.2 Mecrear AIエージェント構想

```
         患者データ（EMR）
              │
    ┌─────────▼─────────┐
    │  ルールエンジン      │  医療安全の絶対ルール
    │  (Gate Keeper)      │  - 薬剤禁忌チェック
    │                     │  - アレルギー確認
    │                     │  - ガイドライン準拠
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  分析エージェント    │  LLM + 構造化データ
    │  (AI Agent)         │  - 治療履歴の分析
    │                     │  - 類似症例の検索
    │                     │  - 施術効果の予測
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  パーソナライズ      │  患者個人への最適化
    │  (Meta Learning)    │  - 過去の反応パターン
    │                     │  - 来院傾向の予測
    │                     │  - カスタム提案
    └─────────┬─────────┘
              │
         医師への提案表示
         （最終判断は必ず医師）
```

### 16.3 技術スタックの共通化

| 共通コンポーネント | 香りアプリでの実装 | Mecrearでの転用 |
|---|---|---|
| ルールエンジン基盤 | Next.js Server（香料ルール管理） | 同パターン（医療ルール管理） |
| ML推論サービス | FastAPI + scikit-learn | 同一フレームワーク |
| テキスト埋め込み | multilingual-e5-small | 同一モデルで症状テキスト埋込 |
| フィードバック学習 | NMF協調フィルタリング | NMFで患者嗜好学習 |
| DB | PostgreSQL + Drizzle ORM | 同一（Mecrear既存DB拡張） |

### 16.4 展開ロードマップ

```
2026年
 Q1  香り生成アプリ: データ入力UI開発 + 調香師データ蓄積
 Q2  香り生成アプリ: 3層パイプライン統合・リリース
     Mecrear AI分析: 設計開始（香りアプリ基盤コード移植）
 Q3  Mecrear AI分析: Phase 1（ルール+MLモデル）
     香りアプリ: モデル再学習サイクル運用
 Q4  Mecrear AI分析: Phase 2（+エージェント機能）
```

---

## 付録

### A. LLMの活用箇所（MLモデル外）

| 用途 | 技術 | タイミング |
|------|------|-----------|
| フリーワード → ベクトル変換 | sentence-transformers | 推論時 |
| レシピコンセプト文生成 | Vercel AI SDK (既存) | UX向上 |
| 合成データ初期生成 | OpenAI API (既存) | データ準備時 |
| 季節×感覚マッピング初稿 | OpenAI API | データ準備時 |

### B. 性能比較

| 指標 | LLM依存 | ML本格稼働 |
|------|---------|-----------|
| 推論レイテンシ | 2-5秒 | 100-300ms |
| 月額API費用（1万req） | ¥30,000-50,000 | ほぼゼロ |
| オフライン動作 | 不可 | 可能 |
| 初期データ要件 | 不要 | 調香師レシピ300件以上 |

### C. 既存スタックからの変更サマリ

```
変更なし（既存活用）:
├── Next.js 15 App Router
├── React 19
├── TypeScript strict
├── Tailwind CSS v4
├── Drizzle ORM + PostgreSQL
├── NextAuth.js（CREATOR ロール）
├── Zod バリデーション
├── Decimal.js 精密計算
├── Recharts グラフ
├── Vercel AI SDK
├── Biome + Vitest
└── Turborepo モノレポ

拡張:
├── flavors スキーマ（category, volatility, intensity追加）
├── (creator)/ ルート（data/ 配下にデータ入力UI追加）
├── Server Actions（5ファイル追加）
└── lib/rule-engine.ts（Layer 1 新規）

新規追加:
├── packages/db/schema/ に5テーブル追加（全て uuid PK）
├── packages/ml/（Python FastAPI、Phase 2で追加）
├── models/（学習済みモデルファイル）
└── lib/fragrance-map/（フレグランスマップ機能、実装済み）
```

---

*最終更新: 2026年2月14日*
*プロジェクト: 株式会社キャライノベイト 香り提案アプリ*
*開発スタック: Next.js 15 + Drizzle ORM + Turborepo モノレポ*
