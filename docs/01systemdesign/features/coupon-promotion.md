# クーポン・プロモーション設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | クーポン作成・適用・管理・利用統計 |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

管理者が各種クーポンを作成・管理し、顧客が注文時にクーポンコードを適用して割引を受ける機能。
割引率（%）、固定額（円）、送料無料の3種類をサポートし、利用条件や上限を柔軟に設定できる。

---

## 2. クーポン種類

### 2.1 割引タイプ

| タイプ | コード | 説明 | 計算例 |
|--------|--------|------|--------|
| 割引率 | `PERCENTAGE` | 注文金額に対する割引率（%） | ¥8,000 の 10% = ¥800 OFF |
| 固定額 | `FIXED_AMOUNT` | 固定金額の割引（円） | ¥500 OFF |
| 送料無料 | `FREE_SHIPPING` | 送料を無料にする | 送料 ¥600 → ¥0 |

### 2.2 計算ロジック

```typescript
import Decimal from 'decimal.js';

type DiscountResult = {
  discountAmount: Decimal;     // 割引金額
  shippingDiscount: Decimal;   // 送料割引金額
  finalAmount: Decimal;        // 最終金額
};

function calculateDiscount(
  subtotal: Decimal,          // 商品小計（税抜）
  shippingFee: Decimal,       // 送料
  coupon: Coupon,
): DiscountResult {
  let discountAmount = new Decimal(0);
  let shippingDiscount = new Decimal(0);

  switch (coupon.discountType) {
    case 'PERCENTAGE': {
      discountAmount = subtotal
        .times(new Decimal(coupon.discountValue).div(100))
        .toDecimalPlaces(0, Decimal.ROUND_DOWN);

      // 最大割引額の制限
      if (coupon.maxDiscountAmount) {
        discountAmount = Decimal.min(discountAmount, new Decimal(coupon.maxDiscountAmount));
      }
      break;
    }
    case 'FIXED_AMOUNT': {
      discountAmount = Decimal.min(new Decimal(coupon.discountValue), subtotal);
      break;
    }
    case 'FREE_SHIPPING': {
      shippingDiscount = shippingFee;
      break;
    }
  }

  const finalAmount = subtotal.plus(shippingFee).minus(discountAmount).minus(shippingDiscount);

  return {
    discountAmount,
    shippingDiscount,
    finalAmount: Decimal.max(finalAmount, new Decimal(0)),
  };
}
```

---

## 3. 利用条件

### 3.1 条件一覧

| 条件 | フィールド | 型 | 説明 |
|------|-----------|-----|------|
| 最低注文金額 | `min_order_amount` | decimal | この金額以上の注文でのみ使用可能 |
| 初回限定 | `first_order_only` | boolean | 初回注文のユーザーのみ使用可能 |
| カテゴリ限定 | `category_ids` | uuid[] | 指定カテゴリの商品を含む注文のみ |
| クリエーター限定 | `creator_ids` | uuid[] | 指定クリエーターの商品を含む注文のみ |
| 期間 | `starts_at` / `expires_at` | timestamp | 有効期間 |
| 使用上限（全体） | `max_usage_total` | integer | 全ユーザー合計での最大使用回数 |
| 使用上限（ユーザー別） | `max_usage_per_user` | integer | 1ユーザーあたりの最大使用回数 |

### 3.2 1注文1クーポン制約

1回の注文に対して適用できるクーポンは **1枚のみ**。
複数クーポンの併用は不可。

### 3.3 バリデーションロジック

```typescript
// lib/coupon-validator.ts

type CouponValidationResult =
  | { valid: true; coupon: Coupon }
  | { valid: false; error: string };

async function validateCoupon(
  code: string,
  userId: string,
  orderSubtotal: Decimal,
  orderItems: OrderItem[],
): Promise<CouponValidationResult> {
  // 1. クーポン存在チェック
  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, code.toUpperCase()),
  });
  if (!coupon) return { valid: false, error: 'クーポンコードが見つかりません' };

  // 2. 有効期間チェック
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { valid: false, error: 'このクーポンはまだ有効期間前です' };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, error: 'このクーポンは有効期限切れです' };
  }

  // 3. アクティブチェック
  if (!coupon.isActive) {
    return { valid: false, error: 'このクーポンは現在無効です' };
  }

  // 4. 全体使用上限チェック
  if (coupon.maxUsageTotal) {
    const totalUsage = await db.select({ count: sql`count(*)` })
      .from(couponUsages)
      .where(eq(couponUsages.couponId, coupon.id));
    if (Number(totalUsage[0].count) >= coupon.maxUsageTotal) {
      return { valid: false, error: 'このクーポンの使用上限に達しています' };
    }
  }

  // 5. ユーザー別使用上限チェック
  if (coupon.maxUsagePerUser) {
    const userUsage = await db.select({ count: sql`count(*)` })
      .from(couponUsages)
      .where(and(
        eq(couponUsages.couponId, coupon.id),
        eq(couponUsages.userId, userId),
      ));
    if (Number(userUsage[0].count) >= coupon.maxUsagePerUser) {
      return { valid: false, error: 'このクーポンの使用回数上限に達しています' };
    }
  }

  // 6. 最低注文金額チェック
  if (coupon.minOrderAmount && orderSubtotal.lt(new Decimal(coupon.minOrderAmount))) {
    return {
      valid: false,
      error: `このクーポンは¥${coupon.minOrderAmount}以上の注文で使用できます`,
    };
  }

  // 7. 初回限定チェック
  if (coupon.firstOrderOnly) {
    const previousOrders = await db.select({ count: sql`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.userId, userId),
        eq(orders.paymentStatus, 'PAID'),
      ));
    if (Number(previousOrders[0].count) > 0) {
      return { valid: false, error: 'このクーポンは初回注文限定です' };
    }
  }

  // 8. カテゴリ限定チェック
  if (coupon.categoryIds && coupon.categoryIds.length > 0) {
    const hasMatchingCategory = orderItems.some(item =>
      coupon.categoryIds.includes(item.categoryId),
    );
    if (!hasMatchingCategory) {
      return { valid: false, error: 'このクーポンは対象カテゴリの商品にのみ使用できます' };
    }
  }

  // 9. クリエーター限定チェック
  if (coupon.creatorIds && coupon.creatorIds.length > 0) {
    const hasMatchingCreator = orderItems.some(item =>
      coupon.creatorIds.includes(item.creatorId),
    );
    if (!hasMatchingCreator) {
      return { valid: false, error: 'このクーポンは対象クリエーターの商品にのみ使用できます' };
    }
  }

  return { valid: true, coupon };
}
```

---

## 4. クーポンコード生成

### 4.1 自動生成ルール

| 項目 | 値 |
|------|-----|
| 形式 | 英大文字 + 数字 |
| 長さ | 8文字 |
| プレフィックス | 任意（例: `WELCOME`, `SUMMER`） |
| ユニーク制約 | `coupons.code` にユニーク制約 |

### 4.2 生成ロジック

```typescript
function generateCouponCode(prefix?: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外（0,O,I,1）
  const randomPart = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');

  return prefix ? `${prefix}-${randomPart}` : randomPart;
}

// 生成例:
// generateCouponCode()           → "K7NP3XYZ"
// generateCouponCode("WELCOME")  → "WELCOME-K7NP3XYZ"
// generateCouponCode("SUMMER")   → "SUMMER-A2B4C6D8"
```

---

## 5. CRUD 管理画面

### 5.1 クーポン一覧画面

```
┌──────────────────────────────────────────────────┐
│  クーポン管理                    [+ 新規作成]       │
├──────────────────────────────────────────────────┤
│  フィルタ: [全て] [有効] [期限切れ] [無効]          │
│  検索: [__________________] [検索]                │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │ コード     │ タイプ │ 値   │ 使用  │ 期限    │ 状態 │
│  │────────────│───────│──────│──────│────────│─────│
│  │ WELCOME-XX │ 10%   │      │ 23/100│ 3/31   │ 有効│
│  │ SUMMER-YY  │ ¥500  │      │ 45/∞ │ 8/31   │ 有効│
│  │ FREESHIP-Z │ 送料無料│     │ 12/50│ 2/28   │期限切│
│  │ VIP-ABCD   │ 20%   │      │ 5/10 │ 無期限 │ 有効│
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ページ: [< 1 2 3 >]                              │
└──────────────────────────────────────────────────┘
```

### 5.2 クーポン作成/編集フォーム

```
┌──────────────────────────────────────────────────┐
│  クーポン作成                                      │
├──────────────────────────────────────────────────┤
│                                                  │
│  クーポンコード:                                   │
│  [SUMMER-________] [自動生成]                     │
│  プレフィックス: [SUMMER____]                      │
│                                                  │
│  割引タイプ: (●) 割引率  (○) 固定額  (○) 送料無料  │
│                                                  │
│  割引値: [10] %                                   │
│  最大割引額: [2000] 円（割引率の場合のみ）           │
│                                                  │
│  ── 利用条件 ──                                   │
│  最低注文金額: [3000] 円                           │
│  初回限定: [○] はい  (●) いいえ                    │
│                                                  │
│  カテゴリ限定: [全カテゴリ ▼]                       │
│  クリエーター限定: [全クリエーター ▼]                │
│                                                  │
│  ── 期間・上限 ──                                 │
│  開始日: [2026-03-01]                             │
│  終了日: [2026-03-31]                             │
│  使用上限（全体）: [100] 回  ※空欄=無制限           │
│  使用上限（ユーザー別）: [1] 回                     │
│                                                  │
│  [プレビュー]  [保存]                              │
└──────────────────────────────────────────────────┘
```

### 5.3 Zod スキーマ

```typescript
// actions/admin/coupon.ts

const couponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  discountValue: z.number().min(0),
  maxDiscountAmount: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),
  firstOrderOnly: z.boolean().default(false),
  categoryIds: z.array(z.string().uuid()).optional(),
  creatorIds: z.array(z.string().uuid()).optional(),
  startsAt: z.date().optional(),
  expiresAt: z.date().optional(),
  maxUsageTotal: z.number().int().min(1).optional(),
  maxUsagePerUser: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
}).refine(data => {
  if (data.discountType === 'PERCENTAGE') {
    return data.discountValue > 0 && data.discountValue <= 100;
  }
  if (data.discountType === 'FIXED_AMOUNT') {
    return data.discountValue > 0;
  }
  return true;
}, { message: '割引値が不正です' });
```

---

## 6. 利用統計

### 6.1 統計ダッシュボード

```
┌──────────────────────────────────────────────────┐
│  クーポン利用統計     期間: [2026年1月 ▼]          │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 使用回数  │ │ 割引総額  │ │ 利用率   │          │
│  │   156回   │ │ ¥78,500  │ │  12.3%  │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                  │
│  クーポン別内訳                                    │
│  ┌───────────────────────────────────────────┐   │
│  │ コード     │ 使用数│ 割引額  │ 平均注文額 │ 利用率│
│  │────────────│──────│────────│──────────│──────│
│  │ WELCOME-XX │   23 │¥11,500│  ¥7,200 │ 23%  │
│  │ SUMMER-YY  │   45 │¥22,500│  ¥9,800 │ 45%  │
│  │ VIP-ABCD   │    5 │ ¥8,000│ ¥12,500 │ 50%  │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  [CSVエクスポート]                                 │
└──────────────────────────────────────────────────┘
```

### 6.2 統計データ型

```typescript
type CouponStatsSummary = {
  totalUsageCount: number;          // 総使用回数
  totalDiscountAmount: number;      // 割引総額
  usageRate: number;                // 利用率（クーポン使用注文 / 全注文）
};

type CouponStatsDetail = {
  couponId: string;
  code: string;
  discountType: DiscountType;
  usageCount: number;               // 使用回数
  totalDiscountAmount: number;      // 割引総額
  avgOrderAmount: number;           // 平均注文額
  usageRate: number;                // 利用率（使用数 / 上限）
  remainingUsage: number | null;    // 残り使用回数（null=無制限）
};
```

---

## 7. 注文フロー連携

### 7.1 カート画面でのクーポン適用

```
┌──────────────────────────────────────────────────┐
│  カート                                           │
├──────────────────────────────────────────────────┤
│  商品小計:    ¥8,000                              │
│  送料:        ¥600                                │
│                                                  │
│  クーポンコード: [SUMMER-A2B4C6D8] [適用]          │
│  ✓ クーポン適用: 10% OFF (-¥800)                  │
│                                                  │
│  ───────────────                                 │
│  合計:        ¥7,800                              │
│                                                  │
│  [注文を確定する]                                  │
└──────────────────────────────────────────────────┘
```

### 7.2 注文確定時の処理

```typescript
// actions/order.ts（クーポン関連部分）

async function createOrderWithCoupon(
  tx: Transaction,
  orderId: string,
  userId: string,
  couponCode: string | null,
  subtotal: Decimal,
  shippingFee: Decimal,
): Promise<{ discountAmount: Decimal; finalAmount: Decimal }> {
  if (!couponCode) {
    return {
      discountAmount: new Decimal(0),
      finalAmount: subtotal.plus(shippingFee),
    };
  }

  // バリデーション（トランザクション内で再検証）
  const validation = await validateCoupon(couponCode, userId, subtotal, []);
  if (!validation.valid) throw new Error(validation.error);

  const result = calculateDiscount(subtotal, shippingFee, validation.coupon);

  // クーポン使用記録
  await tx.insert(couponUsages).values({
    couponId: validation.coupon.id,
    userId,
    orderId,
    discountAmount: result.discountAmount.toString(),
    shippingDiscount: result.shippingDiscount.toString(),
  });

  return {
    discountAmount: result.discountAmount.plus(result.shippingDiscount),
    finalAmount: result.finalAmount,
  };
}
```

---

## 8. DB スキーマ

### 8.1 coupons（クーポン）

```typescript
// packages/db/src/schema/coupons.ts

export const discountTypeEnum = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;
export type DiscountType = (typeof discountTypeEnum)[number];

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // コード
    code: varchar('code', { length: 30 }).notNull().unique(),

    // 割引設定
    discountType: varchar('discount_type', { length: 20 })
      .notNull()
      .$type<DiscountType>(),
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    maxDiscountAmount: decimal('max_discount_amount', { precision: 10, scale: 2 }),

    // 利用条件
    minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    categoryIds: jsonb('category_ids').$type<string[]>(),
    creatorIds: jsonb('creator_ids').$type<string[]>(),

    // 期間
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),

    // 使用上限
    maxUsageTotal: integer('max_usage_total'),
    maxUsagePerUser: integer('max_usage_per_user'),

    // 状態
    isActive: boolean('is_active').notNull().default(true),

    // メタ
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_coupons_code').on(table.code),
    index('idx_coupons_active').on(table.isActive),
    index('idx_coupons_expires').on(table.expiresAt),
  ],
);
```

### 8.2 coupon_usages（クーポン使用履歴）

```typescript
// packages/db/src/schema/coupon-usages.ts

export const couponUsages = pgTable(
  'coupon_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    // 割引額
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull(),
    shippingDiscount: decimal('shipping_discount', { precision: 10, scale: 2 }).notNull().default('0.00'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_coupon_usages_coupon').on(table.couponId),
    index('idx_coupon_usages_user').on(table.userId),
    index('idx_coupon_usages_order').on(table.orderId),
    unique('uq_coupon_usages_order').on(table.orderId), // 1注文1クーポン
  ],
);

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsages.couponId],
    references: [coupons.id],
  }),
  user: one(users, {
    fields: [couponUsages.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [couponUsages.orderId],
    references: [orders.id],
  }),
}));
```

### 8.3 ER図

```
coupons
  ├── code (UNIQUE)
  ├── discount_type (PERCENTAGE/FIXED_AMOUNT/FREE_SHIPPING)
  ├── discount_value
  ├── max_discount_amount
  ├── min_order_amount
  ├── first_order_only
  ├── category_ids (jsonb)
  ├── creator_ids (jsonb)
  ├── starts_at / expires_at
  ├── max_usage_total / max_usage_per_user
  ├── is_active
  │
  └── 1:N ── coupon_usages
               ├── user_id → users
               ├── order_id → orders (UNIQUE)
               ├── discount_amount
               └── shipping_discount
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-15 | 初版作成 |

---

*最終更新: 2026年2月15日*
