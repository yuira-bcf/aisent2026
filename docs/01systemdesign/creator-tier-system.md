# クリエーターティアシステム設計書

## 概要

ユーザー評価に基づくクリエーターのランク制度。
品質・信頼性の可視化と、上位クリエーターへのインセンティブ付与を目的とする。

---

## ティア定義

| ティア | コード | 名称 | アイコン | カラー | 最低スコア |
|--------|--------|------|---------|--------|-----------|
| T1 | `APPRENTICE` | Apprentice | ◇ | `#a3a3a3` (gray-400) | 0 |
| T2 | `ARTISAN` | Artisan | ◆ | `#cd7f32` (bronze) | 30 |
| T3 | `EXPERT` | Expert | ◆ | `#94a3b8` (silver) | 55 |
| T4 | `MASTER` | Master | ◆ | `#d97706` (gold) | 75 |
| T5 | `GRAND_MASTER` | Grand Master | ◆ | `#a78bfa` (platinum) | 90 |

---

## ティアスコア計算ロジック

### 入力指標

| 指標 | 重み | ソース | 正規化 |
|------|------|--------|--------|
| 平均評価（★） | 30% | `creator_stats.avg_rating` | `(rating - 1.0) / 4.0 × 100` → 0〜100 |
| リピート率 | 25% | `creator_stats.repeat_rate` | そのまま 0〜100 |
| お気に入り数 | 20% | `creator_stats.favorite_count` | `min(ln(count + 1) / ln(500) × 100, 100)` |
| レシピ売上数 | 15% | `creator_stats.recipe_sales_count` | `min(ln(count + 1) / ln(1000) × 100, 100)` |
| レシピレビュー数 | 10% | `creator_stats.recipe_review_count` | `min(ln(count + 1) / ln(300) × 100, 100)` |

### 計算式

```typescript
function calculateTierScore(stats: CreatorStats): number {
  const ratingNorm = ((stats.avgRating - 1.0) / 4.0) * 100;
  const repeatNorm = stats.repeatRate;
  const favNorm = Math.min((Math.log(stats.favoriteCount + 1) / Math.log(500)) * 100, 100);
  const recipeSalesNorm = Math.min((Math.log(stats.recipeSalesCount + 1) / Math.log(1000)) * 100, 100);
  const recipeReviewNorm = Math.min((Math.log(stats.recipeReviewCount + 1) / Math.log(300)) * 100, 100);

  return (
    ratingNorm      * 0.30 +
    repeatNorm      * 0.25 +
    favNorm         * 0.20 +
    recipeSalesNorm * 0.15 +
    recipeReviewNorm * 0.10
  );
}
```

### 足切り条件

ティアスコアが高くても、以下の最低条件を満たさない場合は昇格しない:

| ティア | 最低レシピ売上数 | 最低レシピレビュー数 | 最低★ |
|--------|-----------------|-------------------|------|
| T2 Artisan | 50 | 10 | 3.5 |
| T3 Expert | 150 | 40 | 4.0 |
| T4 Master | 300 | 80 | 4.3 |
| T5 Grand Master | 500 | 150 | 4.5 |

### ティア判定

```typescript
function determineTier(score: number, stats: CreatorStats): CreatorTier {
  if (score >= 90 && stats.recipeSalesCount >= 500 && stats.recipeReviewCount >= 150 && stats.avgRating >= 4.5)
    return 'GRAND_MASTER';
  if (score >= 75 && stats.recipeSalesCount >= 300 && stats.recipeReviewCount >= 80 && stats.avgRating >= 4.3)
    return 'MASTER';
  if (score >= 55 && stats.recipeSalesCount >= 150 && stats.recipeReviewCount >= 40 && stats.avgRating >= 4.0)
    return 'EXPERT';
  if (score >= 30 && stats.recipeSalesCount >= 50 && stats.recipeReviewCount >= 10 && stats.avgRating >= 3.5)
    return 'ARTISAN';
  return 'APPRENTICE';
}
```

---

## 更新タイミング

| イベント | 処理 |
|---------|------|
| 月次バッチ（毎月1日 03:00） | 全クリエーターのスコア再計算 → ティア更新 |
| 即時反映 | `recipe_sales_count`, `favorite_count` 等はリアルタイム更新（集計カラム） |
| 降格保護 | 3ヶ月連続で基準未達の場合のみ降格（`months_below_threshold` カウンター） |

---

## DB スキーマ設計

### 新規テーブル: `creator_stats`

クリエーターごとの集計統計とティア情報を保持するテーブル。
`users` テーブルと 1:1 リレーション。

```typescript
// packages/db/src/schema/creator-stats.ts

import { pgTable, uuid, integer, decimal, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

// ── Enum ──

export const creatorTierEnum = [
  'APPRENTICE',
  'ARTISAN',
  'EXPERT',
  'MASTER',
  'GRAND_MASTER',
] as const;

export type CreatorTier = (typeof creatorTierEnum)[number];

// ── Table ──

export const creatorStats = pgTable(
  'creator_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // FK: users.id（CREATOR ロールのユーザー）
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    // ── 集計カラム（リアルタイム更新） ──
    recipeSalesCount: integer('recipe_sales_count').notNull().default(0),
    favoriteCount: integer('favorite_count').notNull().default(0),
    recipeReviewCount: integer('recipe_review_count').notNull().default(0),
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
    repeatRate: decimal('repeat_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),

    // ── ティア情報（月次バッチ更新） ──
    tierScore: decimal('tier_score', { precision: 5, scale: 2 }).notNull().default('0.00'),
    tier: varchar('tier', { length: 20 }).notNull().default('APPRENTICE').$type<CreatorTier>(),
    tierUpdatedAt: timestamp('tier_updated_at').notNull().defaultNow(),
    monthsBelowThreshold: integer('months_below_threshold').notNull().default(0),

    // ── タイムスタンプ ──
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_creator_stats_user_id').on(table.userId),
    index('idx_creator_stats_tier').on(table.tier),
    index('idx_creator_stats_tier_score').on(table.tierScore),
  ],
);

// ── Relations ──

export const creatorStatsRelations = relations(creatorStats, ({ one }) => ({
  user: one(users, {
    fields: [creatorStats.userId],
    references: [users.id],
  }),
}));
```

### レビューテーブル: `recipe_reviews`

ユーザーからレシピへのレビュー。`avg_rating` / `recipe_review_count` の算出元。

> 詳細は [review-system.md](features/review-system.md) を参照

```typescript
// packages/db/src/schema/recipe-reviews.ts

import { pgTable, uuid, integer, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { signatureRecipes } from './signature-recipes.js';

export const recipeReviews = pgTable(
  'recipe_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // レビュー対象のレシピ
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => signatureRecipes.id, { onDelete: 'cascade' }),

    // レビュー対象レシピのクリエーター（集計用）
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // レビュー投稿者（カスタマー）
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 評価 1〜5
    rating: integer('rating').notNull(),

    // コメント（任意）
    comment: text('comment'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_recipe_reviews_recipe_id').on(table.recipeId),
    index('idx_recipe_reviews_creator_id').on(table.creatorId),
    index('idx_recipe_reviews_reviewer_id').on(table.reviewerId),
    unique('uq_recipe_reviews').on(table.reviewerId, table.recipeId),
  ],
);

export const recipeReviewsRelations = relations(recipeReviews, ({ one }) => ({
  recipe: one(signatureRecipes, {
    fields: [recipeReviews.recipeId],
    references: [signatureRecipes.id],
  }),
  creator: one(users, {
    fields: [recipeReviews.creatorId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [recipeReviews.reviewerId],
    references: [users.id],
  }),
}));
```

### schema/index.ts への追加

```typescript
export { creatorStats, creatorTierEnum, type CreatorTier, creatorStatsRelations } from './creator-stats.js';
export { recipeReviews, recipeReviewsRelations } from './recipe-reviews.js';
```

---

## 計算ロジック実装ファイル

```
apps/web/lib/creator-tier.ts
```

```typescript
import Decimal from 'decimal.js';

// ── Types ──

export type CreatorTier = 'APPRENTICE' | 'ARTISAN' | 'EXPERT' | 'MASTER' | 'GRAND_MASTER';

export interface CreatorStatsInput {
  avgRating: number;        // 1.00 〜 5.00
  repeatRate: number;       // 0.00 〜 100.00 (%)
  favoriteCount: number;
  recipeSalesCount: number;   // レシピ売上数
  recipeReviewCount: number;  // レシピレビュー数
}

export interface TierResult {
  score: number;
  tier: CreatorTier;
  nextTier: CreatorTier | null;
  progress: number; // 0〜100 — 次ティアへの進捗
}

// ── Constants ──

const TIER_THRESHOLDS: {
  tier: CreatorTier;
  minScore: number;
  minRecipeSales: number;
  minRecipeReviews: number;
  minRating: number;
}[] = [
  { tier: 'GRAND_MASTER', minScore: 90, minRecipeSales: 500, minRecipeReviews: 150, minRating: 4.5 },
  { tier: 'MASTER',       minScore: 75, minRecipeSales: 300, minRecipeReviews: 80,  minRating: 4.3 },
  { tier: 'EXPERT',       minScore: 55, minRecipeSales: 150, minRecipeReviews: 40,  minRating: 4.0 },
  { tier: 'ARTISAN',      minScore: 30, minRecipeSales: 50,  minRecipeReviews: 10,  minRating: 3.5 },
  { tier: 'APPRENTICE',   minScore: 0,  minRecipeSales: 0,   minRecipeReviews: 0,   minRating: 0   },
];

const WEIGHTS = {
  rating:      new Decimal('0.30'),
  repeat:      new Decimal('0.25'),
  favorite:    new Decimal('0.20'),
  recipeSales: new Decimal('0.15'),
  recipeReview: new Decimal('0.10'),
};

// ── Normalize Helpers ──

function logNormalize(count: number, base: number): number {
  if (count <= 0) return 0;
  return Math.min((Math.log(count + 1) / Math.log(base)) * 100, 100);
}

// ── Main Functions ──

export function calculateTierScore(stats: CreatorStatsInput): number {
  const ratingNorm      = new Decimal(stats.avgRating).minus(1).div(4).times(100);
  const repeatNorm      = new Decimal(stats.repeatRate);
  const favNorm         = new Decimal(logNormalize(stats.favoriteCount, 500));
  const recipeSalesNorm = new Decimal(logNormalize(stats.recipeSalesCount, 1000));
  const recipeReviewNorm = new Decimal(logNormalize(stats.recipeReviewCount, 300));

  const score = ratingNorm.times(WEIGHTS.rating)
    .plus(repeatNorm.times(WEIGHTS.repeat))
    .plus(favNorm.times(WEIGHTS.favorite))
    .plus(recipeSalesNorm.times(WEIGHTS.recipeSales))
    .plus(recipeReviewNorm.times(WEIGHTS.recipeReview));

  return score.toDecimalPlaces(2).toNumber();
}

export function determineTier(stats: CreatorStatsInput): TierResult {
  const score = calculateTierScore(stats);

  let tier: CreatorTier = 'APPRENTICE';
  let tierIndex = TIER_THRESHOLDS.length - 1;

  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    const t = TIER_THRESHOLDS[i];
    if (
      score >= t.minScore &&
      stats.recipeSalesCount >= t.minRecipeSales &&
      stats.recipeReviewCount >= t.minRecipeReviews &&
      stats.avgRating >= t.minRating
    ) {
      tier = t.tier;
      tierIndex = i;
      break;
    }
  }

  // 次ティアへの進捗
  const nextTierIndex = tierIndex - 1;
  let nextTier: CreatorTier | null = null;
  let progress = 100;

  if (nextTierIndex >= 0) {
    const next = TIER_THRESHOLDS[nextTierIndex];
    const current = TIER_THRESHOLDS[tierIndex];
    nextTier = next.tier;
    const range = next.minScore - current.minScore;
    progress = range > 0 ? Math.min(((score - current.minScore) / range) * 100, 100) : 0;
  }

  return { score, tier, nextTier, progress };
}

// ── Display Helpers ──

export const TIER_DISPLAY: Record<CreatorTier, {
  label: string;
  labelJa: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  APPRENTICE:   { label: 'Apprentice',   labelJa: 'アプレンティス', color: '#a3a3a3', bgColor: '#f5f5f5', icon: '◇' },
  ARTISAN:      { label: 'Artisan',      labelJa: 'アルティザン',   color: '#cd7f32', bgColor: '#fef3c7', icon: '◆' },
  EXPERT:       { label: 'Expert',       labelJa: 'エキスパート',   color: '#94a3b8', bgColor: '#f1f5f9', icon: '◆' },
  MASTER:       { label: 'Master',       labelJa: 'マスター',       color: '#d97706', bgColor: '#fffbeb', icon: '◆' },
  GRAND_MASTER: { label: 'Grand Master', labelJa: 'グランドマスター', color: '#7c3aed', bgColor: '#f5f3ff', icon: '◆' },
};
```

---

## モックアップ上のティア表示仕様

### クリエーター一覧カード

- 名前の右にティアバッジ: `◆ Master` をティアカラーで表示
- フィルターに「ティア」セレクトを追加

### クリエーター一覧ピックアップ

- 名前横にティアバッジ表示

### クリエーター詳細ヒーロー

- 認証バッジの隣にティアバッジ: `◆ Grand Master` を表示

---

## ER 図（関連テーブル）

```
users (CREATOR)
  ├── 1:1 ── creator_stats
  │            ├── recipe_sales_count
  │            ├── favorite_count
  │            ├── recipe_review_count
  │            ├── avg_rating
  │            ├── repeat_rate
  │            ├── tier_score
  │            ├── tier (APPRENTICE〜GRAND_MASTER)
  │            └── months_below_threshold
  │
  ├── 1:N ── signature_recipes
  │            └── 1:1 ── recipe_stats
  │                         ├── sales_count
  │                         ├── review_count
  │                         ├── avg_rating
  │                         └── favorite_count
  │
  └── (recipe_reviews 経由でレビューを集計)
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-14 | 初版作成 |
| 2026-02-14 | モード3ハイブリッド型に移行。入力指標: blend_count→recipe_sales_count, review_count→recipe_review_count に変更。足切り条件の閾値名変更 |

---

*最終更新: 2026年2月14日*
