# レシピシステム設計書

> FM-007（RPN=245）、FM-011（RPN=150）、FM-020（RPN=180）、FM-024（RPN=140）、FM-026（RPN=180）への対応として、レシピAPIルート設計、画面↔API対応表、パフォーマンス最適化を定義する。

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 作成日 | 2026-02-17 |
| 関連設計書 | [creator-system.md](./creator-system.md)、[blend-system.md](./blend-system.md) |

---

## 1. 概要

レシピシステムは、クリエーターが作成するシグネチャーレシピの管理、顧客向けの閲覧・購入フロー、および管理者による商品（Products）管理を担う。

### 1.1 関連テーブル

| テーブル | 用途 |
|---------|------|
| `signature_recipes` | シグネチャーレシピ本体 |
| `signature_recipe_flavors` | レシピ内香料配合 |
| `recipe_stats` | レシピ統計（平均評価、レビュー数、売上数） |
| `products` | 商品（レシピ→商品化） |
| `product_variants` | 商品バリアント（容量、価格） — スキーマ定義は [ec-shop.md §6.2](./ec-shop.md) を参照 |

---

## 2. レシピサービス関数設計（FM-007, RPN=245）

### 2.1 サービス関数一覧

```typescript
// services/recipe-service.ts

/** レシピ一覧取得（公開済み、ページネーション付き） */
export async function getPublishedRecipes(params: {
  page: number;
  limit: number;
  sort: 'newest' | 'popular' | 'rating';
  creatorId?: string;
  keyword?: string;
}): Promise<PaginatedResult<RecipeWithStats>>

/** レシピ詳細取得 */
export async function getRecipeDetail(
  recipeId: string,
): Promise<RecipeDetail | null>

/** クリエーター自身のレシピ一覧 */
export async function getMyRecipes(
  creatorUserId: string,
): Promise<RecipeWithStats[]>

/** レシピ作成 */
export async function createRecipe(
  creatorUserId: string,
  input: CreateRecipeInput,
): Promise<SignatureRecipe>

/** レシピ更新 */
export async function updateRecipe(
  recipeId: string,
  creatorUserId: string,
  input: UpdateRecipeInput,
): Promise<SignatureRecipe>

/** レシピ公開/非公開切替 */
export async function toggleRecipeVisibility(
  recipeId: string,
  creatorUserId: string,
): Promise<{ isPublished: boolean }>

/** レシピ削除（論理削除） */
export async function deleteRecipe(
  recipeId: string,
  creatorUserId: string,
): Promise<void>

/** レシピ統計取得 */
export async function getRecipeStats(
  recipeId: string,
): Promise<RecipeStats>
```

### 2.2 対応APIルート

| メソッド | パス | サービス関数 | 認証 | ロール |
|---------|------|------------|------|--------|
| `GET` | `/api/v1/recipes` | `getPublishedRecipes` | 不要 | 全ユーザー |
| `GET` | `/api/v1/recipes/:id` | `getRecipeDetail` | 不要 | 全ユーザー |
| `GET` | `/api/v1/creator/recipes` | `getMyRecipes` | 必須 | CREATOR |
| `POST` | `/api/v1/creator/recipes` | `createRecipe` | 必須 | CREATOR |
| `PUT` | `/api/v1/creator/recipes/:id` | `updateRecipe` | 必須 | CREATOR（所有者） |
| `PATCH` | `/api/v1/creator/recipes/:id/visibility` | `toggleRecipeVisibility` | 必須 | CREATOR（所有者） |
| `DELETE` | `/api/v1/creator/recipes/:id` | `deleteRecipe` | 必須 | CREATOR（所有者） |
| `GET` | `/api/v1/recipes/:id/stats` | `getRecipeStats` | 不要 | 全ユーザー |

---

## 3. 画面↔API対応表（FM-011, RPN=150）

### 3.1 顧客向け画面

| 画面 | パス | 使用API | 備考 |
|------|------|---------|------|
| レシピ一覧 | `/recipes` | `GET /api/v1/recipes` | ページネーション、ソート |
| レシピ詳細 | `/recipes/:id` | `GET /api/v1/recipes/:id`, `GET /api/v1/recipes/:id/reviews`, `GET /api/v1/recipes/:id/stats` | 並列取得 |
| クリエーター別レシピ | `/creators/:id` | `GET /api/v1/recipes?creatorId=xxx` | フィルタ |
| カートに追加 | — | `POST /api/v1/cart/items` | [cart-checkout-orders.md](./cart-checkout-orders.md) 参照 |
| レビュー投稿 | `/orders/:id/review` | `POST /api/v1/recipes/:id/reviews` | [review-system.md](./review-system.md) 参照 |
| 調合結果→商品化 | `/blend/:id/order` | `POST /api/v1/cart/items` | 調合結果を商品として追加 |

### 3.2 クリエーター向け画面

| 画面 | パス | 使用API | 備考 |
|------|------|---------|------|
| レシピ管理一覧 | `/creator/recipes` | `GET /api/v1/creator/recipes` | — |
| レシピ新規作成 | `/creator/recipes/new` | `POST /api/v1/creator/recipes` | — |
| レシピ編集 | `/creator/recipes/:id` | `PUT /api/v1/creator/recipes/:id` | 所有権チェック |
| レシピ公開/非公開 | — | `PATCH /api/v1/creator/recipes/:id/visibility` | トグル |
| レシピ統計 | `/creator/recipes/:id/stats` | `GET /api/v1/recipes/:id/stats` | — |
| ダッシュボード | `/creator/dashboard` | `GET /api/v1/creator/recipes`, `GET /api/v1/creator/stats` | 複数API |

### 3.3 管理者向け画面

| 画面 | パス | 使用API | 備考 |
|------|------|---------|------|
| レシピ管理 | `/admin/recipes` | `GET /api/v1/admin/recipes` | 全レシピ一覧 |
| レシピ詳細（管理） | `/admin/recipes/:id` | `GET /api/v1/admin/recipes/:id` | 非公開含む |
| 商品管理 | `/admin/products` | `GET /api/v1/admin/products` | — |
| 商品作成 | `/admin/products/new` | `POST /api/v1/admin/products` | レシピ→商品化 |
| 商品編集 | `/admin/products/:id` | `PUT /api/v1/admin/products/:id` | — |

---

## 4. Products管理者CRUD API設計（FM-020, RPN=180）

### 4.1 エンドポイント一覧

| メソッド | パス | 説明 | 認証 | ロール |
|---------|------|------|------|--------|
| `GET` | `/api/v1/admin/products` | 商品一覧 | 必須 | ADMIN |
| `GET` | `/api/v1/admin/products/:id` | 商品詳細 | 必須 | ADMIN |
| `POST` | `/api/v1/admin/products` | 商品作成（レシピ→商品化） | 必須 | ADMIN |
| `PUT` | `/api/v1/admin/products/:id` | 商品更新 | 必須 | ADMIN |
| `DELETE` | `/api/v1/admin/products/:id` | 商品削除（論理削除） | 必須 | ADMIN |
| `PATCH` | `/api/v1/admin/products/:id/status` | 商品ステータス変更 | 必須 | ADMIN |

### 4.2 商品作成リクエスト

```typescript
const createProductSchema = z.object({
  recipeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  variants: z.array(z.object({
    volume: z.enum(['30ml', '50ml', '100ml']),
    priceYen: z.number().int().min(1000).max(100000),
    stock: z.number().int().min(0),
  })).min(1).max(5),
  isPublished: z.boolean().default(false),
});
```

### 4.3 商品ステータス

| ステータス | 説明 |
|----------|------|
| `DRAFT` | 下書き（非公開） |
| `PUBLISHED` | 公開中 |
| `SOLD_OUT` | 在庫切れ |
| `DISCONTINUED` | 販売終了 |

---

## 5. レシピ詳細クエリ並列化設計（FM-024, RPN=140）

### 5.1 問題

レシピ詳細画面では複数のデータソースからの取得が必要であり、逐次実行するとレイテンシが増大する。

### 5.2 並列化設計

```typescript
// app/(customer)/recipes/[id]/page.tsx
export default async function RecipeDetailPage({ params }: Props) {
  // 3つの独立クエリを並列実行
  const [recipe, reviews, relatedRecipes] = await Promise.all([
    getRecipeDetail(params.id),
    getRecipeReviews(params.id, { page: 1, limit: 5, sort: 'newest' }),
    getRelatedRecipes(params.id, { limit: 4 }),
  ]);

  if (!recipe) notFound();

  return (
    <RecipeDetailLayout
      recipe={recipe}
      reviews={reviews}
      relatedRecipes={relatedRecipes}
    />
  );
}
```

### 5.3 レイテンシ比較

| パターン | レシピ取得 | レビュー取得 | 関連レシピ | 合計 |
|---------|-----------|------------|-----------|------|
| 逐次実行 | 50ms | 80ms | 60ms | **190ms** |
| 並列実行 | — | — | — | **max(50, 80, 60) = 80ms** |

---

## 6. FKカラムインデックス一覧（FM-026, RPN=180）

### 6.1 レシピ関連テーブル

| テーブル | カラム | インデックス名 | 用途 |
|---------|--------|--------------|------|
| `signature_recipes` | `creator_id` | `idx_recipes_creator_id` | クリエーター別レシピ一覧 |
| `signature_recipe_flavors` | `recipe_id` | `idx_recipe_flavors_recipe_id` | レシピ別香料取得 |
| `signature_recipe_flavors` | `flavor_id` | `idx_recipe_flavors_flavor_id` | 香料別使用レシピ検索 |
| `recipe_stats` | `recipe_id` | `idx_recipe_stats_recipe_id` | レシピ統計JOIN（UNIQUE） |
| `recipe_reviews` | `recipe_id` | `idx_recipe_reviews_recipe_id` | レシピ別レビュー取得 |
| `recipe_reviews` | `reviewer_id` | `idx_recipe_reviews_reviewer_id` | ユーザー別レビュー履歴 |
| `products` | `recipe_id` | `idx_products_recipe_id` | レシピ→商品逆引き |

### 6.2 調合関連テーブル

| テーブル | カラム | インデックス名 | 用途 |
|---------|--------|--------------|------|
| `blend_requests` | `user_id` | `idx_blend_requests_user_id` | ユーザー別調合履歴 |
| `blend_request_keywords` | `blend_request_id` | `idx_brk_blend_request_id` | リクエスト別キーワード |
| `blend_request_keywords` | `keyword_id` | `idx_brk_keyword_id` | キーワード別使用状況 |
| `blend_results` | `blend_request_id` | `idx_blend_results_request_id` | リクエスト→結果 |
| `blend_result_flavors` | `blend_result_id` | `idx_brf_blend_result_id` | 結果別香料配合 |
| `keyword_flavor_rules` | `keyword_id` | `idx_kfr_keyword_id` | キーワード別ルール |
| `keyword_flavor_rules` | `flavor_id` | `idx_kfr_flavor_id` | 香料別ルール |

### 6.3 Drizzle ORM インデックス定義例

```typescript
// packages/db/src/schema/recipes.ts
import { index } from 'drizzle-orm/pg-core';

export const recipesCreatorIdIdx = index('idx_recipes_creator_id')
  .on(signatureRecipes.creatorId);
export const recipeFlavorsRecipeIdIdx = index('idx_recipe_flavors_recipe_id')
  .on(signatureRecipeFlavors.recipeId);
export const recipeFlavorsFlavorIdIdx = index('idx_recipe_flavors_flavor_id')
  .on(signatureRecipeFlavors.flavorId);
```

## 7. DBスキーマ（Drizzle ORM）

> `products`, `product_variants` のスキーマ定義は [ec-shop.md §6.1, §6.2](./ec-shop.md) を参照。本セクションではレシピ固有の3テーブルを定義する。

### 7.1 signature_recipes テーブル

```typescript
export const signatureRecipes = pgTable('signature_recipes', {
  id: uuid('id').defaultRandom().primaryKey(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  concept: text('concept').notNull(),
  scene: varchar('scene', { length: 30 }).notNull(),
  mood: varchar('mood', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
    // DRAFT | PUBLISHED | ARCHIVED
  version: integer('version').notNull().default(1),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
  deletedAt: timestamp('deleted_at'),
});
```

### 7.2 signature_recipe_flavors テーブル

```typescript
export const signatureRecipeFlavors = pgTable('signature_recipe_flavors', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull().references(() => signatureRecipes.id, { onDelete: 'cascade' }),
  flavorId: uuid('flavor_id').notNull().references(() => flavors.id),
  ratio: integer('ratio').notNull(), // 0-100, 合計100
  noteType: varchar('note_type', { length: 10 }).notNull(), // TOP | MIDDLE | LAST
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueFlavor: unique().on(table.recipeId, table.flavorId),
}));
```

### 7.3 recipe_stats テーブル

```typescript
export const recipeStats = pgTable('recipe_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull().unique().references(() => signatureRecipes.id, { onDelete: 'cascade' }),
  salesCount: integer('sales_count').default(0).notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).default('0.00'),
  favoriteCount: integer('favorite_count').default(0).notNull(),
  totalRevenue: integer('total_revenue').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## 8. APIレスポンス型

```typescript
// レシピ一覧アイテム
type RecipeListItem = {
  id: string;
  name: string;
  concept: string;
  scene: string;
  mood: string;
  imageUrl: string | null;
  creator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tier: string;
  };
  stats: {
    avgRating: number;
    reviewCount: number;
    salesCount: number;
  };
  variants: {
    volume: number;
    price: number;
    salePrice: number | null;
  }[];
  createdAt: string; // ISO 8601
};

// ページネーション付きレスポンス
type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// レシピ詳細
type RecipeDetail = RecipeListItem & {
  flavors: {
    flavorId: string;
    flavorName: string;
    ratio: number;
    noteType: 'TOP' | 'MIDDLE' | 'LAST';
    category: string;
  }[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  publishedAt: string | null;
};

// クリエイター用レシピ（非公開情報含む）
type CreatorRecipeItem = RecipeDetail & {
  stats: RecipeDetail['stats'] & {
    totalRevenue: number;
    favoriteCount: number;
  };
};
```

---

## 9. 入力バリデーション（Zod スキーマ）

```typescript
// レシピ作成
export const createRecipeSchema = z.object({
  name: z.string().min(1, 'レシピ名は必須です').max(100, '100文字以内で入力してください'),
  concept: z.string().min(10, 'コンセプトは10文字以上で入力してください').max(2000),
  scene: z.enum(['デート', 'オフィス', 'パーティー', 'リラックス', 'アウトドア', 'フォーマル']),
  mood: z.enum(['明るい', '落ち着いた', '情熱的', 'ミステリアス', '清潔感']),
  flavors: z.array(z.object({
    flavorId: z.string().uuid(),
    ratio: z.number().int().min(1).max(100),
    noteType: z.enum(['TOP', 'MIDDLE', 'LAST']),
  })).min(1, '香料を1つ以上選択してください').max(15, '香料は15種類以内です')
    .refine(
      (flavors) => flavors.reduce((sum, f) => sum + f.ratio, 0) === 100,
      { message: '配合比率の合計は100%にしてください' }
    ),
  imageUrl: z.string().url().optional(),
});

// レシピ更新（部分更新可能）
export const updateRecipeSchema = createRecipeSchema.partial();

// レシピ一覧クエリ
export const recipeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['newest', 'popular', 'rating']).default('newest'),
  creatorId: z.string().uuid().optional(),
  keyword: z.string().max(100).optional(),
  scene: z.enum(['デート', 'オフィス', 'パーティー', 'リラックス', 'アウトドア', 'フォーマル']).optional(),
  mood: z.enum(['明るい', '落ち着いた', '情熱的', 'ミステリアス', '清潔感']).optional(),
});
```

---

## 10. エラーコード

| コード | HTTPステータス | 説明 | 発生条件 |
|--------|-------------|------|---------|
| `RECIPE_NOT_FOUND` | 404 | レシピが見つかりません | 存在しないIDまたは削除済み |
| `RECIPE_NOT_PUBLISHED` | 403 | 非公開レシピです | 一般ユーザーが非公開レシピにアクセス |
| `RECIPE_NOT_OWNED` | 403 | 他のクリエイターのレシピです | 他人のレシピを編集/削除しようとした |
| `RECIPE_ALREADY_PUBLISHED` | 400 | 公開済みのレシピは直接編集できません | PUBLISHEDレシピにupdateRecipe |
| `RECIPE_LIMIT_EXCEEDED` | 400 | レシピ上限(50件)に達しています | クリエイター1人あたり上限50レシピ |
| `INVALID_FLAVOR_RATIO` | 400 | 配合比率の合計が100%ではありません | Zodバリデーションのfallback |
| `FLAVOR_NOT_FOUND` | 400 | 指定された香料が存在しません | 無効なflavorId |

---

## 11. ビジネスルール

| ルール | 値 | 根拠 |
|--------|-----|------|
| クリエイター1人あたりレシピ上限 | 50件 | プラットフォーム品質管理 |
| レシピ名の最大文字数 | 100文字 | UI表示制約 |
| 配合香料数 | 1〜15種類 | 製造実用性 |
| 配合比率の合計 | 必ず100% | 物理的制約 |
| 公開レシピの編集 | バージョンアップとして新版を作成 | 既存注文の整合性保持 |
| 削除 | 論理削除（deletedAt設定） | 注文履歴参照のため |
| 公開→非公開 | いつでも可能 | 新規注文を停止、既存注文は完了まで継続 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | B-08対応: §7 DBスキーマ、§8 APIレスポンス型、§9 入力バリデーション、§10 エラーコード、§11 ビジネスルール追加 |
| 2026-02-17 | B-07修正: §1.1 の product_variants に ec-shop.md §6.2 への相互参照リンクを追加 |
| 2026-02-17 | 初版作成（FMEA FM-007, FM-011, FM-020, FM-024, FM-026 対応） |

---

*最終更新: 2026年2月17日*
