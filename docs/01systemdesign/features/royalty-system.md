# ロイヤリティ・報酬システム設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | ロイヤリティ計算・月次集計・支払い管理 |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

クリエーターのシグネチャーレシピを使った商品の売上に応じてロイヤリティ（報酬）を計算・支払いする仕組み。
ティア制度と連動し、上位ティアのクリエーターにはより高い報酬率を適用する。
ロイヤリティはレシピ単位で計算され、`styled` モード（スタイル補正適用）および `recipe` モード（レシピ直接使用）の注文が対象となる。`ai_only` モードの注文にはクリエーター紐付けがないため、ロイヤリティは発生しない。

---

## 2. ロイヤリティ計算

### 2.1 基本ルール

| 項目 | 値 |
|------|-----|
| デフォルト料率 | 15% |
| Master/Grand Master 料率 | 20% |
| 計算基準 | 注文商品金額（税抜・送料除外） |
| 精度 | Decimal.js で小数点以下2桁（四捨五入） |

### 2.2 ティア別料率

| ティア | ロイヤリティ率 |
|--------|-------------|
| APPRENTICE | 15% |
| ARTISAN | 15% |
| EXPERT | 15% |
| MASTER | 20% |
| GRAND_MASTER | 20% |

### 2.3 モード別ロイヤリティ配分

| モード | ロイヤリティ対象 | 料率 | 根拠 |
|--------|----------------|------|------|
| `ai_only` | 対象外 | 0% | クリエーター紐付けなし |
| `styled` | クリエーター（スタイル提供者） | ティア料率 × 0.7 | ベースAI配合の補正のみのため、`recipe` モードの70%を適用 |
| `recipe` | クリエーター（レシピ作成者） | ティア料率 × 1.0 | レシピ全体がクリエーターの創作物 |

**計算例（styled モード）:**
```
注文金額: ¥8,000（税抜）
クリエーター: Master ティア（基本料率 20%）
styled 係数: 0.7
ロイヤリティ = ¥8,000 × 0.20 × 0.7 = ¥1,120
```

### 2.4 計算式

```typescript
import Decimal from 'decimal.js';

type BlendMode = 'ai_only' | 'styled' | 'recipe';

// モード別係数
const MODE_COEFFICIENTS: Record<BlendMode, number> = {
  ai_only: 0,      // ロイヤリティ対象外
  styled: 0.7,     // スタイル補正のみ → 70%
  recipe: 1.0,     // レシピ全体 → 100%
};

function calculateRoyalty(
  orderAmount: number,       // 商品金額（税抜）
  creatorTier: CreatorTier,  // クリエーターのティア
  blendMode: BlendMode,      // 調合モード
  customRate?: number,       // 管理者による個別設定（あれば優先）
): Decimal {
  const baseRate = customRate
    ?? (creatorTier === 'MASTER' || creatorTier === 'GRAND_MASTER' ? 0.20 : 0.15);
  const modeCoeff = MODE_COEFFICIENTS[blendMode];

  return new Decimal(orderAmount)
    .times(baseRate)
    .times(modeCoeff)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
```

### 2.5 計算例

```
注文金額: ¥8,000（税抜）
クリエーター: Master ティア（料率 20%）
ロイヤリティ = ¥8,000 × 0.20 = ¥1,600

注文金額: ¥5,500（税抜）
クリエーター: Artisan ティア（料率 15%）
ロイヤリティ = ¥5,500 × 0.15 = ¥825
```

---

## 3. 支払いサイクル

### 3.1 基本サイクル

| 項目 | 値 |
|------|-----|
| 締め日 | 毎月末日 23:59:59 |
| 支払い日 | 翌月15日 |
| 最低支払い額 | ¥1,000 |
| 繰越 | 最低支払い額未満の場合、翌月に繰越 |

### 3.2 タイムライン

```
2026年1月
  1日〜31日: 注文発生 → 個別ロイヤリティ計算（royalty_calculations に記録）
  31日 23:59: 1月分締め

2026年2月
  1日 04:00: 月次集計バッチ実行 → royalty_payments レコード作成
  15日: 支払い実行
```

### 3.3 支払い対象条件

以下の全てを満たす注文のみロイヤリティ対象:

| 条件 | 説明 |
|------|------|
| 注文ステータス | `COMPLETED`（完了済み） |
| 決済ステータス | `PAID`（決済完了） |
| キャンセル | キャンセル・返品されていない |
| 調合モード | `styled` または `recipe`（`ai_only` は対象外） |
| レシピ紐付け | `orders.recipe_id` が存在する、または `orders.creator_id` が存在する |

---

## 4. 月次集計バッチ処理

### 4.1 バッチ概要

| 項目 | 値 |
|------|-----|
| 実行タイミング | 毎月1日 04:00 JST |
| 対象期間 | 前月1日 00:00:00 〜 前月末日 23:59:59 |
| 実行方法 | Node.js スクリプト（cron） |

### 4.2 バッチ処理フロー

```typescript
// scripts/monthly-royalty-batch.ts

async function runMonthlyRoyaltyBatch(targetMonth: string): Promise<BatchResult> {
  const { startDate, endDate } = getMonthRange(targetMonth); // "2026-01" → 1/1〜1/31

  // 1. 対象注文を取得（styled/recipe モードのレシピ紐付き注文のみ）
  const completedOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.status, 'COMPLETED'),
      eq(orders.paymentStatus, 'PAID'),
      gte(orders.completedAt, startDate),
      lte(orders.completedAt, endDate),
      isNotNull(orders.creatorId),
      inArray(orders.blendMode, ['styled', 'recipe']),
    ),
    with: { creator: { with: { stats: true } }, recipe: true },
  });

  // 2. クリエーター別に集計
  const creatorSummaries = new Map<string, {
    creatorId: string;
    totalSales: Decimal;
    orderCount: number;
    royaltyAmount: Decimal;
    tier: CreatorTier;
  }>();

  for (const order of completedOrders) {
    const creatorId = order.creatorId;
    const summary = creatorSummaries.get(creatorId) ?? {
      creatorId,
      totalSales: new Decimal(0),
      orderCount: 0,
      royaltyAmount: new Decimal(0),
      tier: order.creator.stats.tier,
    };

    const orderAmount = new Decimal(order.subtotalAmount); // 税抜商品金額
    const royalty = calculateRoyalty(orderAmount.toNumber(), summary.tier);

    summary.totalSales = summary.totalSales.plus(orderAmount);
    summary.orderCount++;
    summary.royaltyAmount = summary.royaltyAmount.plus(royalty);

    creatorSummaries.set(creatorId, summary);

    // 3. 個別計算レコード作成
    await db.insert(royaltyCalculations).values({
      orderId: order.id,
      creatorId,
      recipeId: order.recipeId ?? null,  // recipe モード時のみ
      orderAmount: orderAmount.toString(),
      royaltyRate: getRoyaltyRate(summary.tier).toString(),
      royaltyAmount: royalty.toString(),
      calculatedMonth: targetMonth,
    });
  }

  // 4. 支払いレコード作成
  for (const [creatorId, summary] of creatorSummaries) {
    // 前月繰越分を加算
    const carryOver = await getCarryOverAmount(creatorId);
    const totalPayable = summary.royaltyAmount.plus(carryOver);

    const status: PaymentStatus = totalPayable.gte(1000)
      ? 'PENDING'         // 支払い対象
      : 'CARRIED_OVER';   // 繰越

    await db.insert(royaltyPayments).values({
      creatorId,
      targetMonth,
      totalSales: summary.totalSales.toString(),
      orderCount: summary.orderCount,
      royaltyAmount: summary.royaltyAmount.toString(),
      carryOverAmount: carryOver.toString(),
      payableAmount: totalPayable.toString(),
      status,
      scheduledPaymentDate: getPaymentDate(targetMonth), // 翌月15日
    });
  }

  return { processedOrders: completedOrders.length, creatorCount: creatorSummaries.size };
}
```

### 4.3 エラーハンドリング

| エラー | 対応 |
|--------|------|
| バッチ途中失敗 | トランザクションロールバック、再実行可能 |
| 重複実行防止 | `targetMonth` + `creatorId` のユニーク制約 |
| 注文ステータス不整合 | COMPLETED 以外はスキップ、ログ出力 |

---

## 5. クリエーター別売上・ロイヤリティ追跡

### 5.1 クリエーター向け画面

```
┌──────────────────────────────────────────────────┐
│  ロイヤリティ                     期間: [2026年 ▼] │
├──────────────────────────────────────────────────┤
│                                                  │
│  年間サマリー                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 総売上    │ │ 総ロイヤリティ│ │ 支払済   │          │
│  │ ¥960,000 │ │ ¥192,000 │ │ ¥168,000 │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                  │
│  月別明細                                         │
│  ┌────────────────────────────────────────┐      │
│  │ 月     │ 売上     │ 注文 │ 料率 │ 報酬   │      │
│  │────────│─────────│──────│─────│───────│      │
│  │ 2026/01│ ¥128,000│  45件│  20%│¥25,600│      │
│  │ 2025/12│ ¥115,000│  38件│  20%│¥23,000│      │
│  │ 2025/11│ ¥98,000 │  32件│  15%│¥14,700│      │
│  │ ...    │         │      │     │       │      │
│  └────────────────────────────────────────┘      │
│                                                  │
│  [明細CSVダウンロード]                              │
└──────────────────────────────────────────────────┘
```

### 5.2 データ型

```typescript
type RoyaltySummary = {
  year: number;
  totalSales: number;
  totalRoyalty: number;
  totalPaid: number;
  totalPending: number;
  totalCarriedOver: number;
};

type RoyaltyMonthlyDetail = {
  month: string;             // "2026-01"
  totalSales: number;
  orderCount: number;
  royaltyRate: number;       // 0.15 or 0.20
  royaltyAmount: number;
  carryOverAmount: number;
  payableAmount: number;
  status: 'PENDING' | 'PAID' | 'CARRIED_OVER';
  paidAt: Date | null;
};
```

---

## 6. 支払い履歴・明細ダウンロード

### 6.1 支払い履歴

| フィールド | 説明 |
|-----------|------|
| 支払い月 | 対象月 |
| 売上合計 | 対象月の総売上 |
| 注文件数 | 対象月の注文数 |
| ロイヤリティ率 | 適用された料率 |
| ロイヤリティ額 | 計算されたロイヤリティ |
| 繰越額 | 前月からの繰越 |
| 支払い額 | 実際の支払い額 |
| ステータス | PENDING / PAID / CARRIED_OVER |
| 支払い日 | 実際に支払われた日 |

### 6.2 明細CSVフォーマット

```csv
注文ID,注文日,レシピ名,クリエーター,調合モード,注文金額(税抜),ロイヤリティ率,ロイヤリティ額,ステータス
ord_xxx,2026-01-15,夏の風,tanaka_hanako,recipe,8000,0.20,1600,PAID
ord_yyy,2026-01-18,春の花束,tanaka_hanako,styled,5500,0.20,1100,PAID
```

### 6.3 CSV生成 Server Action

```typescript
// actions/creator-royalty.ts

export async function downloadRoyaltyCSV(month: string): Promise<string> {
  const session = await auth();
  if (session?.user?.role !== 'CREATOR') throw new Error('権限がありません');

  const calculations = await db.query.royaltyCalculations.findMany({
    where: and(
      eq(royaltyCalculations.creatorId, session.user.id),
      eq(royaltyCalculations.calculatedMonth, month),
    ),
    with: { order: true },
    orderBy: asc(royaltyCalculations.createdAt),
  });

  const header = '注文ID,注文日,商品名,注文金額(税抜),ロイヤリティ率,ロイヤリティ額\n';
  const rows = calculations.map(calc =>
    [
      calc.orderId,
      format(calc.order.createdAt, 'yyyy-MM-dd'),
      calc.order.productName,
      calc.orderAmount,
      calc.royaltyRate,
      calc.royaltyAmount,
    ].join(',')
  ).join('\n');

  return header + rows;
}
```

---

## 7. 管理者設定

### 7.1 ロイヤリティ設定項目

| 設定 | デフォルト値 | 説明 |
|------|-----------|------|
| default_royalty_rate | 0.15 | デフォルトロイヤリティ率（15%） |
| master_royalty_rate | 0.20 | Master/Grand Master ロイヤリティ率（20%） |
| payment_cycle | MONTHLY | 支払いサイクル |
| payment_day | 15 | 支払い日（月の何日か） |
| min_payment_amount | 1000 | 最低支払い額（円） |

### 7.2 個別料率設定

管理者は特定クリエーターに対して個別のロイヤリティ率を設定できる。

```typescript
// actions/admin/royalty-settings.ts

const royaltySettingsSchema = z.object({
  defaultRate: z.number().min(0.01).max(0.50),
  masterRate: z.number().min(0.01).max(0.50),
  paymentDay: z.number().int().min(1).max(28),
  minPaymentAmount: z.number().int().min(0),
});

const individualRateSchema = z.object({
  creatorId: z.string().uuid(),
  customRate: z.number().min(0.01).max(0.50),
  reason: z.string().min(1).max(500),
});
```

### 7.3 管理者画面

```
┌──────────────────────────────────────────────────┐
│  ロイヤリティ管理                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  グローバル設定                                    │
│  デフォルト料率: [15] %                            │
│  Master料率:    [20] %                            │
│  支払い日:      毎月 [15] 日                       │
│  最低支払い額:  ¥[1,000]                           │
│  [設定を保存]                                     │
│                                                  │
│  月次支払い一覧       対象月: [2026年1月 ▼]        │
│  ┌───────────────────────────────────────────┐   │
│  │ クリエーター │ 売上    │ 料率│ 報酬   │ 状態  │   │
│  │─────────────│────────│─────│───────│──────│   │
│  │ 田中花子    │¥128,000│ 20% │¥25,600│ 未払い│   │
│  │ 山田太郎    │ ¥85,000│ 15% │¥12,750│ 未払い│   │
│  │ 佐藤美香    │ ¥62,000│ 15% │ ¥9,300│ 未払い│   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  合計: ¥47,650                                    │
│  [一括支払い処理]  [CSVエクスポート]                 │
└──────────────────────────────────────────────────┘
```

---

## 8. DB スキーマ

### 8.1 royalty_calculations（ロイヤリティ計算明細）

```typescript
// packages/db/src/schema/royalty-calculations.ts

export const royaltyCalculations = pgTable(
  'royalty_calculations',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 対象注文
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    // クリエーター
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // レシピ（recipe モードの場合）
    recipeId: uuid('recipe_id')
      .references(() => signatureRecipes.id),

    // 計算内容
    orderAmount: decimal('order_amount', { precision: 10, scale: 2 }).notNull(),
    royaltyRate: decimal('royalty_rate', { precision: 5, scale: 4 }).notNull(),
    royaltyAmount: decimal('royalty_amount', { precision: 10, scale: 2 }).notNull(),

    // 対象月
    calculatedMonth: varchar('calculated_month', { length: 7 }).notNull(), // "2026-01"

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_royalty_calc_creator').on(table.creatorId),
    index('idx_royalty_calc_month').on(table.calculatedMonth),
    index('idx_royalty_calc_order').on(table.orderId),
    unique('uq_royalty_calc_order').on(table.orderId), // 1注文1計算
  ],
);
```

### 8.2 royalty_payments（ロイヤリティ支払い）

```typescript
// packages/db/src/schema/royalty-payments.ts

export const paymentStatusEnum = ['PENDING', 'PAID', 'CARRIED_OVER', 'CANCELLED'] as const;
export type PaymentStatus = (typeof paymentStatusEnum)[number];

export const royaltyPayments = pgTable(
  'royalty_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // クリエーター
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 対象月
    targetMonth: varchar('target_month', { length: 7 }).notNull(), // "2026-01"

    // 集計
    totalSales: decimal('total_sales', { precision: 12, scale: 2 }).notNull(),
    orderCount: integer('order_count').notNull(),
    royaltyAmount: decimal('royalty_amount', { precision: 10, scale: 2 }).notNull(),
    carryOverAmount: decimal('carry_over_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    payableAmount: decimal('payable_amount', { precision: 10, scale: 2 }).notNull(),

    // 支払い
    status: varchar('status', { length: 20 })
      .notNull()
      .default('PENDING')
      .$type<PaymentStatus>(),
    scheduledPaymentDate: timestamp('scheduled_payment_date').notNull(),
    paidAt: timestamp('paid_at'),
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentReference: varchar('payment_reference', { length: 200 }),

    // タイムスタンプ
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_royalty_payments_creator').on(table.creatorId),
    index('idx_royalty_payments_month').on(table.targetMonth),
    index('idx_royalty_payments_status').on(table.status),
    unique('uq_royalty_payments').on(table.creatorId, table.targetMonth),
  ],
);

export const royaltyPaymentsRelations = relations(royaltyPayments, ({ one }) => ({
  creator: one(users, {
    fields: [royaltyPayments.creatorId],
    references: [users.id],
  }),
}));
```

### 8.3 ER図

```
orders
  │
  └── 1:1 ── royalty_calculations
               ├── order_id → orders
               ├── creator_id → users (CREATOR)
               ├── recipe_id → signature_recipes（recipe モード時）
               ├── order_amount
               ├── royalty_rate
               ├── royalty_amount
               └── calculated_month

users (CREATOR)
  │
  └── 1:N ── royalty_payments
               ├── target_month
               ├── total_sales
               ├── order_count
               ├── royalty_amount
               ├── carry_over_amount
               ├── payable_amount
               ├── status (PENDING/PAID/CARRIED_OVER)
               ├── scheduled_payment_date
               └── paid_at
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-15 | 初版作成 |
| 2026-02-17 | styledモードのロイヤリティ配分を明確化（§2.3）。recipe=100%、styled=70%、ai_only=対象外。calculateRoyaltyにblendModeパラメータ追加。 |
| 2026-02-14 | モード3ハイブリッド型に移行。ロイヤリティ計算をレシピ単位に変更、ai_onlyモードは対象外、支払い対象条件にblendMode追加 |

---

*最終更新: 2026年2月14日*
