# レビュー・評価システム設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | レビュー投稿・モデレーション・投票・集計・ティアスコア反映 |
| バージョン | 1.1 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

顧客がクリエーターのシグネチャーレシピに対してレビュー（星評価 + コメント）を投稿する機能。
レビューはレシピの `recipe_stats.avg_rating` / `review_count` に反映され、集計がクリエーターの `creator_stats.recipe_review_count` / `avg_rating` に連動し、ティアスコアの計算入力となる。

> 旧モデルではクリエーター単位のレビュー（`creator_reviews`）だったが、ハイブリッド型ではレシピ単位のレビューに移行する。

---

## 2. レビュー投稿

### 2.1 投稿条件

| 条件 | 説明 |
|------|------|
| 認証 | ログイン済みユーザー（CUSTOMER ロール） |
| 注文完了 | 対象注文のステータスが `COMPLETED` |
| 調合モード | `styled` または `recipe` モードの注文のみ（`ai_only` はレビュー対象外） |
| 1注文1レビュー | 同一注文（`order_id` + `recipe_id`）に対して2回目の投稿は不可 |
| 自己レビュー禁止 | `reviewer_id !== レシピの creator_id` |

### 2.2 投稿フォーム

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|-------------|
| rating | integer | Yes | 1〜5（星評価） |
| comment | string | No | 最大1000文字 |

### 2.3 Zod スキーマ

```typescript
// actions/review.ts

const createReviewSchema = z.object({
  orderId: z.string().uuid(),
  recipeId: z.string().uuid(),        // レビュー対象のレシピ
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
```

### 2.4 Server Action

```typescript
// actions/review.ts

export async function submitReview(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: '認証が必要です' };

  const validated = createReviewSchema.safeParse(Object.fromEntries(formData));
  if (!validated.success) return { error: validated.error.flatten().fieldErrors };

  const { orderId, recipeId, rating, comment } = validated.data;

  // 1. レシピ確認
  const recipe = await db.query.signatureRecipes.findFirst({
    where: eq(signatureRecipes.id, recipeId),
  });
  if (!recipe) return { error: '対象のレシピが見つかりません' };

  // 2. 注文確認（COMPLETED かつ自分の注文 かつ styled/recipe モード）
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.userId, session.user.id),
      eq(orders.status, 'COMPLETED'),
    ),
  });
  if (!order) return { error: '対象の注文が見つかりません' };

  // 3. 重複チェック
  const existing = await db.query.recipeReviews.findFirst({
    where: and(
      eq(recipeReviews.reviewerId, session.user.id),
      eq(recipeReviews.orderId, orderId),
      eq(recipeReviews.recipeId, recipeId),
    ),
  });
  if (existing) return { error: 'このレシピに対するレビューは既に投稿されています' };

  // 4. 自己レビュー防止
  if (recipe.creatorId === session.user.id) {
    return { error: '自分のレシピにレビューはできません' };
  }

  // 5. レビュー保存
  await db.transaction(async (tx) => {
    await tx.insert(recipeReviews).values({
      recipeId,
      reviewerId: session.user.id,
      orderId,
      rating,
      comment: comment ?? null,
      status: 'APPROVED', // 自動承認（デフォルト設定時）
    });

    // 6. recipe_stats 更新
    await updateRecipeStats(tx, recipeId);

    // 7. creator_stats 更新（レシピ経由で集計）
    await updateCreatorStats(tx, recipe.creatorId);
  });

  revalidatePath(`/recipes/${recipeId}`);
  return { success: 'レビューを投稿しました' };
}
```

### 2.5 creator_stats 更新ロジック

```typescript
async function updateRecipeStats(tx: Transaction, recipeId: string) {
  // 承認済みレビューのみ集計
  const reviews = await tx.query.recipeReviews.findMany({
    where: and(
      eq(recipeReviews.recipeId, recipeId),
      eq(recipeReviews.status, 'APPROVED'),
    ),
  });

  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? new Decimal(reviews.reduce((sum, r) => sum + r.rating, 0))
        .div(reviewCount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toString()
    : '0.00';

  await tx.update(recipeStats)
    .set({ reviewCount, avgRating, updatedAt: new Date() })
    .where(eq(recipeStats.recipeId, recipeId));
}

async function updateCreatorStats(tx: Transaction, creatorId: string) {
  // クリエーターの全レシピのレビューを集計
  const creatorRecipes = await tx.query.signatureRecipes.findMany({
    where: eq(signatureRecipes.creatorId, creatorId),
  });
  const recipeIds = creatorRecipes.map(r => r.id);

  const allReviews = await tx.query.recipeReviews.findMany({
    where: and(
      inArray(recipeReviews.recipeId, recipeIds),
      eq(recipeReviews.status, 'APPROVED'),
    ),
  });

  const recipeReviewCount = allReviews.length;
  const avgRating = recipeReviewCount > 0
    ? new Decimal(allReviews.reduce((sum, r) => sum + r.rating, 0))
        .div(recipeReviewCount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toString()
    : '0.00';

  await tx.update(creatorStats)
    .set({ recipeReviewCount, avgRating, updatedAt: new Date() })
    .where(eq(creatorStats.userId, creatorId));
}
```

---

## 3. 「参考になった」投票

### 3.1 仕様

| 項目 | 仕様 |
|------|------|
| 投票者 | ログイン済みユーザー（ロール不問） |
| 投票対象 | 承認済みレビュー |
| 投票回数 | 1ユーザー1レビューにつき1回（トグル式） |
| 表示 | 「参考になった (N)」ボタン |

### 3.2 Server Action

```typescript
// actions/review-vote.ts

export async function toggleReviewVote(reviewId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: '認証が必要です' };

  const existing = await db.query.reviewVotes.findFirst({
    where: and(
      eq(reviewVotes.reviewId, reviewId),
      eq(reviewVotes.userId, session.user.id),
    ),
  });

  if (existing) {
    // 取り消し
    await db.delete(reviewVotes).where(eq(reviewVotes.id, existing.id));
    await updateVoteCount(reviewId);
    return { success: '投票を取り消しました' };
  }

  // 投票
  await db.insert(reviewVotes).values({
    reviewId,
    userId: session.user.id,
  });
  await updateVoteCount(reviewId);

  return { success: '参考になったと投票しました' };
}

async function updateVoteCount(reviewId: string) {
  const count = await db.select({ count: sql`count(*)` })
    .from(reviewVotes)
    .where(eq(reviewVotes.reviewId, reviewId));

  await db.update(recipeReviews)
    .set({ helpfulCount: Number(count[0].count) })
    .where(eq(recipeReviews.id, reviewId));
}
```

---

## 4. モデレーション

### 4.1 モデレーションモード

| モード | 説明 | 設定 |
|--------|------|------|
| AUTO_APPROVE | レビュー投稿時に自動承認 | デフォルト |
| MANUAL_APPROVE | 全レビューを管理者が手動承認 | 管理者設定で切替 |

### 4.2 レビューステータス

```
PENDING → APPROVED → (HIDDEN)
    │         ↑
    └→ REJECTED
          ↑
   (フラグ2件以上で自動遷移)
```

| ステータス | 説明 |
|-----------|------|
| PENDING | 手動承認モード時の初期状態 |
| APPROVED | 承認済み（公開中） |
| REJECTED | 却下（非表示） |
| HIDDEN | 管理者が非表示にした |

### 4.3 フラグ（通報）

```typescript
// actions/review-flag.ts

const flagReasonEnum = [
  'SPAM',           // スパム
  'INAPPROPRIATE',  // 不適切な内容
  'FAKE_REVIEW',    // 虚偽のレビュー
  'HARASSMENT',     // 嫌がらせ
  'OTHER',          // その他
] as const;

export async function flagReview(
  reviewId: string,
  reason: FlagReason,
  description?: string,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: '認証が必要です' };

  // 重複通報チェック
  const existing = await db.query.reviewFlags.findFirst({
    where: and(
      eq(reviewFlags.reviewId, reviewId),
      eq(reviewFlags.reporterId, session.user.id),
    ),
  });
  if (existing) return { error: '既に通報済みです' };

  await db.transaction(async (tx) => {
    // フラグ作成
    await tx.insert(reviewFlags).values({
      reviewId,
      reporterId: session.user.id,
      reason,
      description: description ?? null,
    });

    // フラグ数カウント
    const flagCount = await tx.select({ count: sql`count(*)` })
      .from(reviewFlags)
      .where(eq(reviewFlags.reviewId, reviewId));

    // 2件以上で自動的にステータスをPENDINGに変更（要レビュー）
    if (Number(flagCount[0].count) >= 2) {
      await tx.update(recipeReviews)
        .set({ status: 'PENDING', flagCount: Number(flagCount[0].count) })
        .where(eq(recipeReviews.id, reviewId));
    } else {
      await tx.update(recipeReviews)
        .set({ flagCount: Number(flagCount[0].count) })
        .where(eq(recipeReviews.id, reviewId));
    }
  });

  return { success: '通報を受け付けました' };
}
```

### 4.4 AIモデレーション（投稿時自動審査）

レビュー投稿時にAIが内容を自動審査する。[ハイブリッド調合アーキテクチャ §11.4 #16](../hybrid-blend-architecture.md) で定義された `AI Moderation` 関数を使用。

```typescript
// AI Moderation の審査フロー（レビュー投稿時に自動実行）
type ModerationResult = {
  isApproved: boolean;
  flagReasons: FlagReason[];  // 検出された問題カテゴリ
  confidence: number;         // 0.0〜1.0
  suggestion: string;         // 管理者向け判定理由
};
```

**審査基準:**

| チェック項目 | 説明 | 閾値 |
|-------------|------|------|
| スパム検出 | 宣伝・無関係な内容 | confidence ≥ 0.8 で SPAM フラグ |
| 不適切表現 | 暴言・差別的表現 | confidence ≥ 0.7 で INAPPROPRIATE フラグ |
| フェイクレビュー | 不自然に高/低評価 + 定型文パターン | confidence ≥ 0.8 で FAKE_REVIEW フラグ |
| ハラスメント | 個人攻撃・脅迫 | confidence ≥ 0.7 で HARASSMENT フラグ |

**判定フロー:**

```
レビュー投稿
  │
  ├── AI Moderation 実行（claude-sonnet-4.5）
  │     ├── isApproved = true → status: APPROVED（従来通り）
  │     └── isApproved = false
  │           ├── confidence ≥ 0.9 → status: REJECTED（自動却下 + 管理者通知）
  │           └── confidence < 0.9 → status: PENDING（管理者手動確認待ち）
  │
  └── フォールバック（AI障害時）→ AUTO_APPROVE モードの従来動作
```

- AIモデル: claude-sonnet-4.5（環境変数 `AI_MODEL_MODERATION` で切替可能）
- キャッシュ: なし（毎回実行）
- レイテンシ目標: < 2秒

### 4.5 自動フラグルール

| ルール | アクション |
|--------|----------|
| AIモデレーション却下 | ステータスを `REJECTED` に変更、管理者に通知 |
| AIモデレーション要確認 | ステータスを `PENDING` に変更（管理者レビュー待ち） |
| ユーザーフラグ2件以上 | ステータスを `PENDING` に変更（管理者レビュー待ち） |
| ユーザーフラグ5件以上 | ステータスを `HIDDEN` に自動変更 |

---

## 5. ショップ返信機能

### 5.1 仕様

| 項目 | 仕様 |
|------|------|
| 返信者 | クリエーター本人 または ADMIN |
| 返信対象 | 承認済みレビュー |
| 返信回数 | 1レビューにつき1返信 |
| 文字数 | 最大500文字 |
| 表示 | レビューの直下に「クリエーターからの返信」として表示 |

### 5.2 Server Action

```typescript
// actions/review-reply.ts

const replySchema = z.object({
  reviewId: z.string().uuid(),
  replyText: z.string().min(1).max(500),
});

export async function replyToReview(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: '認証が必要です' };

  const validated = replySchema.safeParse(Object.fromEntries(formData));
  if (!validated.success) return { error: validated.error.flatten().fieldErrors };

  const review = await db.query.recipeReviews.findFirst({
    where: eq(recipeReviews.id, validated.data.reviewId),
  });

  if (!review) return { error: 'レビューが見つかりません' };

  // クリエーター本人 or ADMIN のみ
  if (review.creatorId !== session.user.id && session.user.role !== 'ADMIN') {
    return { error: '権限がありません' };
  }

  // 既に返信済みチェック
  if (review.replyText) return { error: '既に返信済みです' };

  await db.update(recipeReviews)
    .set({
      replyText: validated.data.replyText,
      repliedAt: new Date(),
      repliedBy: session.user.id,
    })
    .where(eq(recipeReviews.id, validated.data.reviewId));

  revalidatePath(`/recipes/${review.recipeId}`);
  return { success: '返信を投稿しました' };
}
```

---

## 6. ティアスコア反映

### 6.1 レビューがティアスコアに与える影響

| 指標 | 重み | 反映タイミング |
|------|------|-------------|
| `avg_rating` | 30% | レシピレビュー投稿・承認・削除時にリアルタイム更新（レシピ→クリエーター集計） |
| `recipe_review_count` | 10% | レシピレビュー投稿・承認・削除時にリアルタイム更新（レシピ→クリエーター集計） |

### 6.2 足切り条件への影響

レシピレビュー数はティア昇格の足切り条件に含まれる:

| ティア | 最低レシピレビュー数 |
|--------|-------------------|
| T2 Artisan | 10件 |
| T3 Expert | 40件 |
| T4 Master | 80件 |
| T5 Grand Master | 150件 |

> ティアスコアの再計算は月次バッチ（毎月1日 03:00）で実行される。
> `avg_rating` と `recipe_review_count` はリアルタイム更新だが、ティア判定は月次。

---

## 7. 管理画面

### 7.1 レビュー管理画面

```
┌──────────────────────────────────────────────────┐
│  レビュー管理                                      │
├──────────────────────────────────────────────────┤
│  フィルタ:                                        │
│  [全て] [フラグ付き(3)] [未承認(5)] [承認済み] [非表示] │
│                                                  │
│  検索: [__________________] [検索]                │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │ ★★★★★ レシピ「夏の風」(田中花子)のレビュー  │   │
│  │ 投稿者: yamada_taro  2026-01-15            │   │
│  │ 「とても素敵な香りでした。夏にぴったり...」   │   │
│  │ 参考になった: 12                            │   │
│  │ フラグ: 0件                                 │   │
│  │ ステータス: APPROVED                        │   │
│  │ [承認] [却下] [非表示] [詳細]                │   │
│  ├───────────────────────────────────────────┤   │
│  │ ★★☆☆☆ レシピ「春の花束」(佐藤美香) ⚠ FLAG x2│   │
│  │ 投稿者: test_user  2026-01-18              │   │
│  │ 「期待はずれでした...」                      │   │
│  │ 参考になった: 1                             │   │
│  │ フラグ: 2件 (FAKE_REVIEW, SPAM)             │   │
│  │ ステータス: PENDING                         │   │
│  │ [承認] [却下] [非表示] [フラグ詳細]           │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ページ: [< 1 2 3 4 5 >]                         │
└──────────────────────────────────────────────────┘
```

### 7.2 管理者アクション

| アクション | 説明 |
|-----------|------|
| 承認 | ステータスを `APPROVED` に変更、`recipe_stats` + `creator_stats` 再集計 |
| 却下 | ステータスを `REJECTED` に変更、`recipe_stats` + `creator_stats` 再集計 |
| 非表示 | ステータスを `HIDDEN` に変更、`recipe_stats` + `creator_stats` 再集計 |
| フラグ詳細 | 通報内容の一覧を表示 |
| 返信削除 | 不適切な返信を削除 |

---

## 8. DB スキーマ

### 8.1 recipe_reviews（レシピレビュー）

旧 `creator_reviews` からレシピ単位のレビューに移行:

```typescript
// packages/db/src/schema/recipe-reviews.ts

export const reviewStatusEnum = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof reviewStatusEnum)[number];

export const recipeReviews = pgTable(
  'recipe_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // レビュー対象のレシピ
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => signatureRecipes.id, { onDelete: 'cascade' }),
    // レビュー投稿者
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // 関連する注文
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    // 評価
    rating: integer('rating').notNull(),
    comment: text('comment'),

    // モデレーション
    status: varchar('status', { length: 20 })
      .notNull()
      .default('APPROVED')
      .$type<ReviewStatus>(),
    flagCount: integer('flag_count').notNull().default(0),

    // 「参考になった」
    helpfulCount: integer('helpful_count').notNull().default(0),

    // ショップ返信
    replyText: text('reply_text'),
    repliedAt: timestamp('replied_at'),
    repliedBy: uuid('replied_by').references(() => users.id),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_recipe_reviews_recipe_id').on(table.recipeId),
    index('idx_recipe_reviews_reviewer_id').on(table.reviewerId),
    index('idx_recipe_reviews_status').on(table.status),
    index('idx_recipe_reviews_flag').on(table.flagCount),
    unique('uq_recipe_reviews_order').on(table.reviewerId, table.orderId, table.recipeId),
  ],
);
```

### 8.2 review_votes（「参考になった」投票）

```typescript
// packages/db/src/schema/review-votes.ts

export const reviewVotes = pgTable(
  'review_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    reviewId: uuid('review_id')
      .notNull()
      .references(() => recipeReviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('uq_review_votes').on(table.reviewId, table.userId),
    index('idx_review_votes_review').on(table.reviewId),
  ],
);
```

### 8.3 review_flags（通報）

```typescript
// packages/db/src/schema/review-flags.ts

export const flagReasonEnum = [
  'SPAM', 'INAPPROPRIATE', 'FAKE_REVIEW', 'HARASSMENT', 'OTHER',
] as const;
export type FlagReason = (typeof flagReasonEnum)[number];

export const reviewFlags = pgTable(
  'review_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    reviewId: uuid('review_id')
      .notNull()
      .references(() => recipeReviews.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    reason: varchar('reason', { length: 30 }).notNull().$type<FlagReason>(),
    description: text('description'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('uq_review_flags').on(table.reviewId, table.reporterId),
    index('idx_review_flags_review').on(table.reviewId),
  ],
);
```

### 8.4 ER図

```
signature_recipes
  │
  └── 1:N ── recipe_reviews
               ├── recipe_id → signature_recipes
               ├── reviewer_id → users (CUSTOMER)
               ├── order_id → orders
               ├── rating (1〜5)
               ├── comment
               ├── status (PENDING/APPROVED/REJECTED/HIDDEN)
               ├── flag_count
               ├── helpful_count
               ├── reply_text
               ├── replied_by → users
               │
               ├── 1:N ── review_votes
               │            ├── user_id → users
               │            └── UNIQUE(review_id, user_id)
               │
               └── 1:N ── review_flags
                            ├── reporter_id → users
                            ├── reason (SPAM/INAPPROPRIATE/...)
                            ├── description
                            └── UNIQUE(review_id, reporter_id)

recipe_reviews → recipe_stats (集計: review_count, avg_rating)
               → creator_stats (集計: recipe_review_count, avg_rating)
```

---

## 9. レビュー表示コンポーネント

### 9.1 レビュー一覧（レシピ詳細ページ / クリエーター詳細ページ）

```
┌──────────────────────────────────────────────────┐
│  レビュー (128件)   ★ 4.5 平均                    │
│                                                  │
│  並び替え: [新着順 ▼]                              │
│  ┌───────────────────────────────────────────┐   │
│  │ ★★★★★  yamada_taro  2026-01-15           │   │
│  │ とても素敵な香りでした。夏にぴったりの      │   │
│  │ さわやかさで、毎日使いたくなります。        │   │
│  │                                           │   │
│  │   クリエーターからの返信:                   │   │
│  │   ありがとうございます！夏の香りは特に      │   │
│  │   こだわって作りました。                    │   │
│  │                                           │   │
│  │ [参考になった (12)]  [通報]                 │   │
│  └───────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────┐   │
│  │ ★★★★☆  tanaka_jiro  2026-01-10           │   │
│  │ 全体的に良い香りですが、持続時間が          │   │
│  │ もう少し長いと嬉しいです。                  │   │
│  │                                           │   │
│  │ [参考になった (5)]  [通報]                  │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 10. ピアレビュー制度（クリエーター間レビュー）

### 10.1 概要

クリエーターが他のクリエーターのレシピ商品を購入・レビューできる仕組み。
専門家視点のレビューはレシピの信頼性向上に寄与する。

### 10.2 レビュー種別

| 種別 | 条件 | バッジ | 表示 |
|------|------|--------|------|
| 通常レビュー | reviewer.role = CUSTOMER | なし | 通常表示 |
| クリエーターレビュー | reviewer.role = CREATOR かつ recipe.creator_id ≠ reviewer_id | 「クリエーターレビュー」バッジ（紫） | 「プロの評価」セクションで目立つ表示 |
| 自作レシピ | recipe.creator_id = reviewer_id | — | レビュー投稿ブロック |

### 10.3 プロ評価軸（クリエーター限定）

通常の評価（総合評価、イメージ一致度、持続性、コストパフォーマンス）に加え、クリエーターのみ以下を入力可能:

| 評価軸 | 説明 | 型 |
|--------|------|---|
| ブレンド技術 | 配合の完成度・バランス | ★1-5 |
| オリジナリティ | 独自性・新規性 | ★1-5 |
| ノート構成 | TOP→MIDDLE→LASTの展開・設計 | ★1-5 |

```typescript
const proReviewSchema = z.object({
  blendTechnique: z.number().int().min(1).max(5),
  originality: z.number().int().min(1).max(5),
  noteComposition: z.number().int().min(1).max(5),
});
```

### 10.4 自作レシピレビューブロック

```typescript
// Server Action: submitReview の前処理
async function validateReviewEligibility(recipeId: string, userId: string) {
  const recipe = await db.query.signatureRecipes.findFirst({
    where: eq(signatureRecipes.id, recipeId),
  });

  if (recipe?.creatorId === userId) {
    throw new Error('自分のレシピにはレビューを書けません');
  }
}
```

**UI表示:**
- 注文一覧: `recipe.creator_id === user.id` のレシピ商品 → レビューボタン非表示、「自分のレシピです」ラベル表示
- 注文詳細: レビューセクション非表示、代わりに「自分のレシピのためレビュー対象外です」表示

### 10.5 相互レビュー検知

| ルール | 処理 |
|--------|------|
| Creator A → Creator B かつ Creator B → Creator A のレビューが存在 | 自動フラグ + 管理者通知 |
| 同一相互レビューが3組以上検出 | レビューの非表示化 + ティアスコアから除外 |

```typescript
async function checkMutualReview(reviewerId: string, recipeCreatorId: string): boolean {
  // reviewerId のレシピに対して recipeCreatorId がレビューしていないか確認
  const reviewerRecipes = await db.query.signatureRecipes.findMany({
    where: eq(signatureRecipes.creatorId, reviewerId),
  });
  const reviewerRecipeIds = reviewerRecipes.map(r => r.id);

  const reverseReview = await db.query.recipeReviews.findFirst({
    where: and(
      inArray(recipeReviews.recipeId, reviewerRecipeIds),
      eq(recipeReviews.reviewerId, recipeCreatorId),
    ),
  });
  return !!reverseReview;
}
```

### 10.6 ティアスコアへの影響

| レビュー種別 | ティアスコア反映 |
|-------------|----------------|
| 通常レビュー | 通常反映（recipe_stats.avg_rating, recipe_stats.review_count → creator_stats に集計） |
| クリエーターレビュー | 通常反映（専門家の評価も同等に扱う） |
| 相互レビュー（フラグ済み） | ティアスコアから除外 |
| 自作レシピレビュー | 投稿不可（ブロック） |

---

## 11. 評価軸の詳細

### 11.1 共通評価軸（全ユーザー）

| 軸 | キー | 説明 | 表示テキスト |
|---|------|------|------------|
| 総合評価 | `overall` | 全体的な満足度 | — |
| イメージ一致度 | `image_match` | 商品説明・ストーリーとの一致度 | 「イメージ通り」 |
| 持続性 | `longevity` | 香りの持続時間 | 「長く続く」 |
| コストパフォーマンス | `value` | 価格に対する満足度 | 「満足」 |

### 11.2 プロ評価軸（クリエーター限定）

| 軸 | キー | 説明 | 表示テキスト |
|---|------|------|------------|
| ブレンド技術 | `blend_technique` | 配合の完成度・バランス | 「優秀」 |
| オリジナリティ | `originality` | 独自性・新規性 | 「独創的」 |
| ノート構成 | `note_composition` | TOP→MIDDLE→LASTの展開 | 「秀逸」 |

### 11.3 Zodスキーマ（更新）

```typescript
const submitReviewSchema = z.object({
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  // 共通評価
  rating: z.number().int().min(1).max(5),
  imageMatch: z.number().int().min(1).max(5).optional(),
  longevity: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  // プロ評価（クリエーターのみ）
  blendTechnique: z.number().int().min(1).max(5).optional(),
  originality: z.number().int().min(1).max(5).optional(),
  noteComposition: z.number().int().min(1).max(5).optional(),
});
```

---

## 12. DBスキーマ追加

### 12.1 recipe_reviews テーブル追加カラム

```typescript
// 8.1 の recipe_reviews テーブルに追加
reviewerRole: varchar('reviewer_role', { length: 20 }).notNull(),
  // CUSTOMER | CREATOR
imageMatch: integer('image_match'),       // 1-5
longevity: integer('longevity'),           // 1-5
value: integer('value'),                   // 1-5
blendTechnique: integer('blend_technique'), // 1-5 (creator only)
originality: integer('originality'),       // 1-5 (creator only)
noteComposition: integer('note_composition'), // 1-5 (creator only)
isMutualReview: boolean('is_mutual_review').default(false),
photoUrls: text('photo_urls'), // JSON array of URLs
```

---

## 13. レビューAPIルート設計（FM-008, RPN=294）

現行設計ではServer Actionsによるレビュー操作が定義されているが、外部連携やモバイルアプリ対応を見据えてREST APIルートを定義する。

### 13.1 エンドポイント一覧

| メソッド | パス | 説明 | 認証 | ロール |
|---------|------|------|------|--------|
| `POST` | `/api/v1/recipes/:id/reviews` | レビュー作成 | 必須 | CUSTOMER, CREATOR |
| `GET` | `/api/v1/recipes/:id/reviews` | レシピ別レビュー一覧 | 不要 | 全ユーザー |
| `GET` | `/api/v1/recipes/:id/reviews/stats` | レビュー統計（平均評価、件数） | 不要 | 全ユーザー |
| `POST` | `/api/v1/reviews/:id/helpful` | 「参考になった」投票 | 必須 | CUSTOMER, CREATOR |
| `DELETE` | `/api/v1/reviews/:id/helpful` | 「参考になった」取消 | 必須 | CUSTOMER, CREATOR |
| `POST` | `/api/v1/reviews/:id/reply` | クリエイター返信 | 必須 | CREATOR（レシピオーナーのみ） |
| `POST` | `/api/v1/reviews/:id/flag` | レビュー通報 | 必須 | CUSTOMER, CREATOR |

### 13.2 レビュー作成 API 詳細

```typescript
// app/api/v1/recipes/[id]/reviews/route.ts
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = submitReviewSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validated.error.flatten() },
      { status: 400 },
    );
  }

  // 購入済みチェック
  const hasPurchased = await checkPurchaseHistory(
    session.user.id,
    params.id,
  );
  if (!hasPurchased) {
    return NextResponse.json(
      { error: '購入済みのレシピのみレビューできます' },
      { status: 403 },
    );
  }

  // 自作レシピチェック
  await validateReviewEligibility(params.id, session.user.id);

  const review = await createReview(params.id, session.user.id, validated.data);
  return NextResponse.json(review, { status: 201 });
}
```

### 13.3 レビュー一覧 API 詳細

```typescript
// app/api/v1/recipes/[id]/reviews/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);
  const sort = searchParams.get('sort') ?? 'newest';
  // sort: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'

  const reviews = await getRecipeReviews(params.id, { page, limit, sort });

  return NextResponse.json({
    reviews: reviews.data,
    pagination: {
      page,
      limit,
      total: reviews.total,
      totalPages: Math.ceil(reviews.total / limit),
    },
  });
}
```

---

## 14. クエリ最適化（FM-025, RPN=210）

### 14.1 問題: AVG(rating) のリアルタイム計算

レシピ一覧画面で各レシピの平均評価を表示するために、リクエストごとに `AVG(rating)` を計算するのは非効率。

### 14.2 解決: recipe_stats テーブルのキャッシュ列

`recipe_stats` テーブルに `avg_rating` と `review_count` のキャッシュ列を設け、レビュー作成/更新/削除時に再計算する。

```typescript
// packages/db/src/schema/recipes.ts
export const recipeStats = pgTable('recipe_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull().unique()
    .references(() => signatureRecipes.id),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).default('0'),
  reviewCount: integer('review_count').default(0),
  helpfulCount: integer('helpful_count').default(0),
  salesCount: integer('sales_count').default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 14.3 再計算ロジック（サービス層）

```typescript
// services/review-service.ts
async function updateRecipeStats(recipeId: string): Promise<void> {
  const stats = await db
    .select({
      avgRating: sql<number>`AVG(${recipeReviews.rating})`,
      reviewCount: sql<number>`COUNT(*)`,
    })
    .from(recipeReviews)
    .where(
      and(
        eq(recipeReviews.recipeId, recipeId),
        eq(recipeReviews.status, 'APPROVED'),
      ),
    );

  await db.update(recipeStats)
    .set({
      avgRating: stats[0].avgRating?.toString() ?? '0',
      reviewCount: stats[0].reviewCount,
      updatedAt: new Date(),
    })
    .where(eq(recipeStats.recipeId, recipeId));
}
```

### 14.4 呼出タイミング

| イベント | 処理 |
|---------|------|
| レビュー作成（`submitReview`） | `updateRecipeStats(recipeId)` |
| レビュー更新（`updateReview`） | `updateRecipeStats(recipeId)` |
| レビュー削除（管理者） | `updateRecipeStats(recipeId)` |
| レビューステータス変更（モデレーション） | `updateRecipeStats(recipeId)` |

### 14.5 クエリ比較

| パターン | レシピ一覧（20件表示） | レシピ詳細 |
|---------|---------------------|-----------|
| 修正前 | 20 × サブクエリ `AVG(rating)` | 1 × サブクエリ |
| 修正後 | JOIN `recipe_stats` テーブル（インデックス付） | JOIN 1回 |

---

## 15. write-review-pro 画面統合設計（FM-030, RPN=40）

### 15.1 課題

`write-review-pro` モックアップ画面が孤立しており、ナビゲーション上どの画面からも遷移できない状態になっている。通常レビューとプロレビューの画面遷移フローが未定義。

### 15.2 画面遷移設計

```
[レシピ詳細画面]
  └─ 「レビューを書く」ボタン
       ├─ 一般ユーザー → /recipes/:id/write-review（通常レビュー）
       └─ クリエイター → /recipes/:id/write-review-pro（プロレビュー）
              ※ 自分のレシピにはレビュー不可（ボタン非表示）
```

### 15.3 ルーティング統合

| 画面パス | コンポーネント | 表示条件 |
|---------|-------------|---------|
| `/recipes/:id/write-review` | `WriteReviewForm` | 認証済みユーザー + 未レビュー |
| `/recipes/:id/write-review-pro` | `WriteReviewProForm` | 認証済みクリエイター + 未レビュー + 他者のレシピ |

### 15.4 遷移ロジック

```typescript
// components/recipe/ReviewButton.tsx
'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export function ReviewButton({ recipeId, creatorId }: { recipeId: string; creatorId: string }) {
  const { data: session } = useSession();

  if (!session) return null;

  // 自分のレシピにはレビュー不可
  if (session.user.id === creatorId) return null;

  const isCreator = session.user.role === 'CREATOR';
  const href = isCreator
    ? `/recipes/${recipeId}/write-review-pro`
    : `/recipes/${recipeId}/write-review`;

  return (
    <Link href={href} className="btn-primary">
      {isCreator ? 'プロレビューを書く' : 'レビューを書く'}
    </Link>
  );
}
```

### 15.5 プロレビュー固有フィールド

| フィールド | 通常レビュー | プロレビュー |
|-----------|------------|------------|
| 評価（星） | ✓ | ✓ |
| タイトル | ✓ | ✓ |
| 本文 | ✓ | ✓ |
| 香りの持続性評価 | - | ✓ |
| 香りの変化（トップ/ミドル/ベース）評価 | - | ✓ |
| プロとしての推薦度 | - | ✓ |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | FMEA対応: write-review-pro画面統合設計（§15）を追加 |
| 2026-02-17 | FMEA対応: レビューAPIルート設計（§13）、クエリ最適化（§14）を追加 |
| 2026-02-17 | AIモデレーション（§4.4）追加。投稿時AI自動審査、confidence閾値による自動却下/保留判定。 |
| 2026-02-15 | ピアレビュー制度追加。クリエーター間レビュー、プロ評価軸、自作品ブロック、相互レビュー検知。 |
| 2026-02-15 | 初版作成 |
| 2026-02-14 | モード3ハイブリッド型に移行。レビュー対象をクリエーター→レシピに変更（creator_reviews → recipe_reviews）。recipe_stats + creator_stats への集計連動追加 |

---

*最終更新: 2026年2月14日*
