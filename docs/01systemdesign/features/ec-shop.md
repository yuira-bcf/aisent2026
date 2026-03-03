# EC ショップ機能 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 対象機能 | EC ショップ（商品一覧・詳細・管理・レシピ連携） |
| バージョン | 1.1 |
| 作成日 | 2026-02-15 |
| 更新日 | 2026-02-14 |

---

## 0. 商品とレシピの関係

ハイブリッド型では、商品はクリエーターの**シグネチャーレシピ**に紐づく。

```
クリエーター
  └── シグネチャーレシピ（signature_recipes）
       └── 商品（products）: recipe_id FK で紐付け
            └── バリアント（product_variants）: 容量別 SKU
```

| 項目 | 説明 |
|------|------|
| 紐付き | 1レシピ : N商品（同一レシピから複数容量・パッケージ展開可能） |
| recipe_id | `products.recipe_id → signature_recipes.id`（任意。NULL の場合は旧商品 or AI調合商品） |
| 配合情報 | 商品の配合チャートは `signature_recipe_flavors` から取得 |
| レビュー | 商品レビューは `recipe_reviews` に紐付き、`recipe_stats` に集計 |
| テーマ | レシピの `scene` + `mood` を商品フィルターに利用 |

### レシピからの商品作成フロー

```
クリエーターダッシュボード
  │
  ├── レシピ管理 → レシピ詳細 → [商品として公開] ボタン
  │     └── 商品作成フォーム（レシピ情報を自動入力）
  │           ├── name: レシピ名をデフォルトセット
  │           ├── description: レシピの concept を流用
  │           ├── notes: recipe_flavors から自動設定（編集不可）
  │           ├── tags: レシピの scene / mood / season をタグに変換
  │           └── variants: 容量・価格・在庫をクリエーターが設定
  │
  └── 商品管理 → 新規作成 → レシピ選択 → 上記と同フロー
```

---

## 1. 商品一覧ページ

### 1.1 フィルター

| フィルター | 型 | UI | 値 |
|-----------|-----|-----|-----|
| カテゴリ | multi-select | チェックボックス | Fresh Floral / Warm Floral / Fresh Woody / Warm Woody |
| 価格帯 | range | デュアルスライダー | ¥0 〜 ¥50,000 |
| 容量 | multi-select | チェックボックス | 10ml / 30ml / 50ml / 100ml |
| 季節 | multi-select | チェックボックス | 春 / 夏 / 秋 / 冬 |
| シーン | multi-select | チェックボックス | デート / オフィス / リラックス / パーティー / アウトドア / フォーマル |
| ムード | multi-select | チェックボックス | 明るい / 落ち着いた / 情熱的 / ミステリアス / 清潔感 |
| クリエーターティア | multi-select | チェックボックス | BRONZE / SILVER / GOLD / PLATINUM |
| 評価 | single | スター選択 | 1〜5（以上） |
| 香りの強さ | single | セグメント | ライト / ミディアム / ストロング |
| 受賞作品のみ | boolean | トグル | ON / OFF |
| ギフト対応のみ | boolean | トグル | ON / OFF |
| 在庫ありのみ | boolean | トグル | ON / OFF（デフォルト ON） |

**URLクエリパラメータ例:**
```
/products?category=fresh-floral,warm-woody&priceMin=3000&priceMax=15000&volume=30,50&season=spring&scene=date&mood=bright&sort=popular&page=1&perPage=20
```

### 1.2 ソート

| キー | 表示名 | ORDER BY |
|------|--------|----------|
| `newest` | 新着順 | `products.createdAt DESC` |
| `popular` | 人気順 | `products.salesCount DESC` |
| `price-asc` | 価格が安い順 | `product_variants.price ASC` |
| `price-desc` | 価格が高い順 | `product_variants.price DESC` |
| `rating` | 評価が高い順 | `products.averageRating DESC` |
| `reviews` | レビューが多い順 | `products.reviewCount DESC` |
| `sales` | 売上順 | `products.salesCount DESC` |
| `favorites` | お気に入り数順 | `products.favoriteCount DESC` |

**デフォルト:** `newest`

### 1.3 表示モード

| 項目 | 仕様 |
|------|------|
| グリッド表示 | 4カラム (デスクトップ) / 2カラム (モバイル) |
| リスト表示 | 1カラム（横長カード） |
| ページネーション | 20件 / 50件 / 100件 切替 |
| デフォルト | グリッド表示、20件/ページ |

### 1.4 商品カード

```
┌───────────────────────────────────┐
│  [バッジ: BEST SELLER / NEW ...]  │
│                                   │
│   ┌──────────────────────┐        │
│   │   商品画像            │  ♡    │
│   │                      │       │
│   │   ホバー → カート追加 │       │
│   └──────────────────────┘        │
│                                   │
│   ┌─────┐  商品名                │
│   │ドーナ│  by クリエーター名 [ティア] │
│   │ツチャ│                        │
│   │ート  │  ★ 4.5 (128件)        │
│   └─────┘  ¥8,800 〜             │
└───────────────────────────────────┘
```

| 要素 | 説明 |
|------|------|
| ドーナツチャート | 配合比率を円グラフ（TOP/MIDDLE/LAST ノート）。レシピ紐付き商品は `signature_recipe_flavors` から取得 |
| 商品名 | 最大2行、超過は省略 |
| レシピ名 | レシピ紐付き商品の場合、商品名の下に「レシピ: {recipe.name}」を小文字で表示 |
| クリエーター名 + ティア | ティアアイコン付き |
| テーマタグ | レシピの `scene` + `mood`（例: 「デート x 明るい」）をミニタグ表示 |
| 価格 | 最安バリアント価格 `¥X,XXX 〜` |
| 評価 | 星 + 平均値 + レビュー件数（`recipe_stats` から取得） |
| バッジ | 条件に応じて複数表示可 |
| お気に入りボタン | ハートアイコン（トグル）、未ログイン時はログイン誘導 |
| ホバーアクション | カートに追加ボタンを画像上にオーバーレイ表示 |

**バッジ条件:**

| バッジ | 条件 |
|--------|------|
| BEST SELLER | `salesCount` が上位10% |
| NEW | `createdAt` が30日以内 |
| 受賞 | `awards` テーブルに関連レコードあり |
| 限定 | `isLimited = true` |
| SALE | `salePrice` が設定済み & 有効期間内 |
| ギフト対応 | `giftWrappingAvailable = true` |

---

## 2. 商品詳細ページ

### 2.1 レイアウト構成

```
┌─────────────────────────────────────────────────┐
│  パンくず: ホーム > カテゴリ > 商品名            │
├────────────────────┬────────────────────────────┤
│                    │  商品名                     │
│   商品画像ギャラリー │  by クリエーター名 [ティア]  │
│   (メイン + サムネ)  │                             │
│                    │  ★ 4.5 (128件)              │
│                    │                             │
│   ドーナツ配合チャート│  容量: [10ml] [30ml] [50ml] │
│                    │  ¥8,800  (定価 ¥11,000)    │
│   ノート構造        │                             │
│   TOP / MIDDLE /   │  □ ギフトラッピング (+¥500)  │
│   LAST             │  数量: [- 1 +]              │
│                    │  [カートに追加]  ♡           │
│   フレグランスマップ │                             │
│   ミニ             │  在庫状態: ○ 在庫あり        │
│                    │  送料: ¥600（¥8,000以上無料）│
│                    │  製造〜発送: 3〜5営業日      │
├────────────────────┴────────────────────────────┤
│  テーマ: デート x 明るい                           │
│  特徴タグ: #フローラル #春向き #デート ...         │
│  AIストーリー: "この香りは..."                     │
├─────────────────────────────────────────────────┤
│  レシピ情報（レシピ紐付き商品の場合）               │
│  レシピ名 / コンセプト / テーマ(scene x mood)     │
│  レシピ評価: ★ 4.3 (64件) / 売上数: 128         │
├─────────────────────────────────────────────────┤
│  クリエーター情報                                 │
│  アイコン / 名前 / ID / ティア / 作品数 / 平均評価 │
├─────────────────────────────────────────────────┤
│  評価サマリー                                     │
│  ★★★★★ ███████████ 65%                         │
│  ★★★★☆ ██████     25%                          │
│  ★★★☆☆ ██         7%                           │
│  ★★☆☆☆ █          2%                           │
│  ★☆☆☆☆            1%                           │
├─────────────────────────────────────────────────┤
│  レビュー一覧                                     │
│  ソート: [新着 | 高評価 | 低評価 | 参考になった]    │
├─────────────────────────────────────────────────┤
│  類似商品 (3点)                                   │
├─────────────────────────────────────────────────┤
│  最近チェックした商品                              │
└─────────────────────────────────────────────────┘
```

### 2.2 配合チャート

**ドーナツチャート (Recharts PieChart):**
- TOP ノート: 外側リング
- MIDDLE ノート: 中間リング
- LAST ノート: 内側リング
- 各香料名 + 配合率 (%) をツールチップ表示

### 2.3 ノート構造

| ノート | 説明 | 持続時間 |
|--------|------|----------|
| TOP | 最初に感じる香り | 〜30分 |
| MIDDLE | 中心となる香り | 30分〜3時間 |
| LAST | 余韻として残る香り | 3時間〜 |

### 2.4 容量選択・価格

**Server Action: `getProductDetail(productId: string)`**

```typescript
const productDetailSchema = z.object({
  productId: z.string().uuid(),
});
```

**容量別バリアント:**

| 容量 | 価格目安 | 在庫個別管理 |
|------|---------|-------------|
| 10ml | ¥3,300〜 | ○ |
| 30ml | ¥6,600〜 | ○ |
| 50ml | ¥8,800〜 | ○ |
| 100ml | ¥13,200〜 | ○ |

**割引表示:**
```
¥8,800  ¥11,000  20% OFF
(セール価格)  (定価 取消線)
```

### 2.5 ギフトラッピング

| 項目 | 仕様 |
|------|------|
| 追加料金 | ¥500（税込） |
| UI | チェックボックス |
| 対応条件 | `product.giftWrappingAvailable = true` |

### 2.6 在庫・配送情報

| 在庫状態 | 表示 | 条件 |
|---------|------|------|
| 在庫あり | ○ 在庫あり（緑） | `stock > 10` |
| 残りわずか | △ 残り{n}点（オレンジ） | `1 <= stock <= 10` |
| 在庫切れ | × 在庫切れ（赤） | `stock = 0` |

| 配送情報 | 表示 |
|---------|------|
| 送料 | ¥600（¥8,000以上で送料無料） |
| 製造〜発送 | 3〜5営業日（商品ごとに設定） |

### 2.7 レシピ情報セクション（レシピ紐付き商品のみ）

商品に `recipe_id` が設定されている場合に表示。

| 項目 | 説明 |
|------|------|
| レシピ名 | `signature_recipes.name` |
| コンセプト | `signature_recipes.concept`（最大3行、超過は「もっと見る」） |
| テーマ | `scene` x `mood`（例: 「デート x 明るい」） |
| レシピ評価 | `recipe_stats.avg_rating` + `recipe_stats.review_count` |
| 累計売上数 | `recipe_stats.sales_count` |
| レシピ詳細リンク | `/recipes/{recipeId}` へ遷移 |

### 2.8 クリエーター情報セクション

| 項目 | 説明 |
|------|------|
| アイコン | プロフィール画像 |
| 名前 | 表示名 |
| ID | `@creatorId` |
| ティア | BRONZE / SILVER / GOLD / PLATINUM アイコン |
| 作品数 | 公開レシピ数（`signature_recipes` の `status = 'published'` 数） |
| 平均評価 | 全レシピの平均（`creator_stats.avg_rating`） |
| プロフィールリンク | クリエーターページへ遷移 |

### 2.9 評価サマリー

- 5段階の横棒グラフ（パーセント表示）
- 平均評価スコア（大きく表示）
- 総レビュー件数

### 2.10 レビュー一覧

レビューは `recipe_reviews` テーブルから取得（レシピ紐付き商品の場合）。

**ソートオプション:**

| キー | 表示名 |
|------|--------|
| `newest` | 新着順 |
| `rating-high` | 高評価順 |
| `rating-low` | 低評価順 |
| `helpful` | 参考になった順 |

**レビューカード:**
- ユーザー名、評価（星）、投稿日
- レビュー本文
- 「参考になった」ボタン + カウント

### 2.11 関連商品

| セクション | ロジック | 表示数 |
|-----------|--------|--------|
| 同じレシピの別商品 | 同一 `recipe_id` の他商品（別容量等） | 最大3点 |
| 同じクリエーターの商品 | 同一 `creator_id` の他商品 | 3点 |
| 類似商品 | 同カテゴリ + 同テーマ（scene x mood） | 3点 |
| 最近チェックした商品 | ブラウザ localStorage に保存 | 最大6点 |

---

## 3. お気に入り機能

### 3.1 Server Action

**`toggleFavorite(productId: string)`**

```typescript
const toggleFavoriteSchema = z.object({
  productId: z.string().uuid(),
});
```

**処理:**
1. セッションからユーザーID取得（未ログインはエラー）
2. `favorites` テーブルを検索
3. 存在すれば削除、なければ挿入
4. `products.favoriteCount` を更新
5. `revalidatePath` で再検証

---

## 4. 商品管理（Admin）

### 4.1 商品CRUD

**Server Action 一覧:**

| Action | 説明 | 権限 |
|--------|------|------|
| `createProduct` | 商品新規作成 | ADMIN, CREATOR(自分の商品) |
| `updateProduct` | 商品更新 | ADMIN, CREATOR(自分の商品) |
| `deleteProduct` | 商品削除（論理削除） | ADMIN |
| `toggleProductPublish` | 公開/非公開切替 | ADMIN, CREATOR(自分の商品) |

### 4.2 商品作成フォーム

**Zodスキーマ:**

```typescript
const createProductSchema = z.object({
  recipeId: z.string().uuid().optional(),  // シグネチャーレシピ紐付け（任意）
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  categoryId: z.string().uuid(),
  notes: z.object({
    top: z.array(z.object({
      flavorId: z.string().uuid(),
      percentage: z.number().min(1).max(100),
    })),
    middle: z.array(z.object({
      flavorId: z.string().uuid(),
      percentage: z.number().min(1).max(100),
    })),
    last: z.array(z.object({
      flavorId: z.string().uuid(),
      percentage: z.number().min(1).max(100),
    })),
  }).refine(data => {
    const total = [...data.top, ...data.middle, ...data.last]
      .reduce((sum, n) => sum + n.percentage, 0);
    return total === 100;
  }, { message: '配合比率の合計は100%にしてください' }),
  variants: z.array(z.object({
    volume: z.enum(['10', '30', '50', '100']),
    price: z.number().int().min(1),
    stock: z.number().int().min(0),
    sku: z.string().min(1),
  })).min(1),
  tags: z.array(z.string()).optional(),
  seasonTags: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).optional(),
  sceneTags: z.array(z.string()).optional(),
  intensity: z.enum(['light', 'medium', 'strong']),
  giftWrappingAvailable: z.boolean().default(false),
  isLimited: z.boolean().default(false),
  manufacturingDays: z.number().int().min(1).max(30).default(5),
  images: z.array(z.string().url()).min(1).max(10),
});
```

### 4.3 在庫管理

| 操作 | 説明 |
|------|------|
| 在庫数変更 | バリアント単位で数量変更 |
| 在庫アラート | 閾値（デフォルト10個）以下で通知 |
| 在庫履歴 | 変更ログを記録 |

### 4.4 セール設定

```typescript
const saleSettingSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(), // 未指定時は全バリアント
  salePrice: z.number().int().min(1),
  saleStartAt: z.string().datetime(),
  saleEndAt: z.string().datetime(),
}).refine(data => new Date(data.saleStartAt) < new Date(data.saleEndAt), {
  message: '終了日は開始日より後にしてください',
});
```

### 4.5 CSV入出力

| 操作 | エンドポイント | 説明 |
|------|---------------|------|
| エクスポート | `GET /api/admin/products/export` | 全商品CSV出力 |
| インポート | `POST /api/admin/products/import` | CSV一括登録/更新 |

**CSVカラム:**
```
id, name, category, volume, price, stock, sku, isPublished, createdAt
```

---

## 5. 検索・ディスカバリー

### 5.1 全文検索

**検索対象:**
| テーブル | カラム | 重み |
|---------|--------|------|
| signature_recipes | name | 高 |
| signature_recipes | description, concept | 中 |
| creator_profiles | display_name, bio | 中 |
| products | name, description | 中 |
| flavors | name_ja, name_en | 低 |

**検索方式:** PostgreSQL `tsvector` + `tsquery` を使用したフルテキスト検索。
日本語対応は `pg_bigm` 拡張を利用（2-gram インデックス）。

**検索API:**
```typescript
searchRecipes(query: string, filters?: SearchFilters, page: number, limit: number)

type SearchFilters = {
  themeId?: string;
  minRating?: number;
  priceRange?: { min?: number; max?: number };
  creatorTier?: string;
  sortBy?: 'relevance' | 'rating' | 'orders' | 'newest' | 'price_asc' | 'price_desc';
};
```

### 5.2 レシピディスカバリー

| セクション | 表示条件 | ソート |
|-----------|---------|--------|
| 人気のレシピ | orderCount > 10, PUBLISHED | orderCount DESC |
| 高評価レシピ | avg_rating >= 4.5, reviewCount >= 5 | avg_rating DESC |
| 新着レシピ | publishedAt within 7 days | publishedAt DESC |
| あなたへのおすすめ | ユーザーの注文/閲覧履歴ベース | AI スコア DESC |
| テーマ別 | themeId グループ | orderCount DESC |

### 5.3 クリエーターディスカバリー

| セクション | 表示条件 | ソート |
|-----------|---------|--------|
| 注目のクリエーター | tier >= EXPERT, publishedRecipeCount >= 3 | totalSales DESC |
| 新着クリエーター | createdAt within 30 days | createdAt DESC |
| ティア別ランキング | tier グループ | tierScore DESC |

---

## 6. DBスキーマ

### 6.1 products テーブル

```typescript
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  recipeId: uuid('recipe_id').references(() => signatureRecipes.id),  // シグネチャーレシピとの紐付け
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  intensity: varchar('intensity', { length: 20 }).notNull(), // light | medium | strong
  giftWrappingAvailable: boolean('gift_wrapping_available').default(false).notNull(),
  isLimited: boolean('is_limited').default(false).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  manufacturingDays: integer('manufacturing_days').default(5).notNull(),
  averageRating: decimal('average_rating', { precision: 2, scale: 1 }).default('0.0'),
  reviewCount: integer('review_count').default(0).notNull(),
  salesCount: integer('sales_count').default(0).notNull(),
  favoriteCount: integer('favorite_count').default(0).notNull(),
  aiStory: text('ai_story'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

### 6.2 product_variants テーブル

```typescript
export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  volume: integer('volume').notNull(), // 10 | 30 | 50 | 100 (ml)
  price: integer('price').notNull(), // 税込価格（円）
  salePrice: integer('sale_price'),
  saleStartAt: timestamp('sale_start_at'),
  saleEndAt: timestamp('sale_end_at'),
  sku: varchar('sku', { length: 50 }).notNull().unique(),
  stock: integer('stock').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 6.3 product_tags テーブル

```typescript
export const productTags = pgTable('product_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  type: varchar('type', { length: 20 }).notNull(), // season | scene | feature
  value: varchar('value', { length: 50 }).notNull(),
}, (table) => ({
  uniqueTag: unique().on(table.productId, table.type, table.value),
}));
```

### 6.4 product_images テーブル

```typescript
export const productImages = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  url: text('url').notNull(),
  alt: varchar('alt', { length: 200 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 6.5 favorites テーブル

```typescript
export const favorites = pgTable('favorites', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueFavorite: unique().on(table.userId, table.productId),
}));
```

### 6.6 インデックス

```typescript
// products
export const productsIdx = {
  creatorIdx: index('products_creator_idx').on(products.creatorId),
  recipeIdx: index('products_recipe_idx').on(products.recipeId),
  categoryIdx: index('products_category_idx').on(products.categoryId),
  publishedIdx: index('products_published_idx').on(products.isPublished),
  createdAtIdx: index('products_created_at_idx').on(products.createdAt),
};

// product_variants
export const variantsIdx = {
  productIdx: index('variants_product_idx').on(productVariants.productId),
  skuIdx: index('variants_sku_idx').on(productVariants.sku),
};

// favorites
export const favoritesIdx = {
  userIdx: index('favorites_user_idx').on(favorites.userId),
  productIdx: index('favorites_product_idx').on(favorites.productId),
};
```

### 6.7 ER図

```
┌──────────────┐     ┌───────────────────┐     ┌───────────────────┐
│   users      │     │   categories      │     │ signature_recipes │
│   (creators) │     │                   │     │ (レシピ)           │
└──────┬───────┘     └────────┬──────────┘     └────────┬──────────┘
       │ 1                    │ 1                       │ 0..1
       │                      │                         │
       │ N                    │ N                       │ 0..N
┌──────▼──────────────────────▼─────────────────────────▼──┐
│                      products                             │
├───────────────────────────────────────────────────────────┤
│ id, creatorId, recipeId, categoryId, name,                │
│ description, intensity, isPublished,                      │
│ averageRating, reviewCount, salesCount,                   │
│ favoriteCount, aiStory, ...                               │
└──┬──────────┬──────────┬─────────────────────────────────┘
   │ 1        │ 1        │ 1
   │          │          │
   │ N        │ N        │ N
┌──▼────┐ ┌──▼──────┐ ┌─▼───────────┐
│product│ │product  │ │product      │
│_varia │ │_tags    │ │_images      │
│nts    │ │         │ │             │
└───────┘ └─────────┘ └─────────────┘

┌──────────┐     ┌──────────┐
│  users   │────<│favorites │>────│ products │
└──────────┘     └──────────┘     └──────────┘

商品とレシピの関係:
  users (creators) → signature_recipes → products
  クリエーターがレシピを作成 → レシピを商品化して販売
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | 検索・ディスカバリーセクション（セクション5）を追加。DBスキーマをセクション6に繰り下げ |
| 2026-02-15 | 初版作成 |
| 2026-02-14 | モード3ハイブリッド型に移行。商品とレシピの関係セクション追加（セクション0）、products テーブルに recipe_id カラム追加、ムードフィルター追加、レシピ情報セクション追加（2.7）、商品作成スキーマに recipeId 追加、ER図にsignature_recipes関係追加 |

---

*最終更新: 2026年2月17日*
