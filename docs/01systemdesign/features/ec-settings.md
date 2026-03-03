# EC設定・システムコンフィグレーション設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | 配送・税率・決済・通知・ロイヤリティ・サイト全般の設定管理 |
| バージョン | 2.0 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

ECプラットフォーム「KyaraInnovate」の運用に必要な各種設定を、管理画面から一元管理する機能を提供する。配送・税率・決済・通知・ロイヤリティ・サイト全般の設定を、コードの変更やデプロイなしに動的に変更可能にする。

### 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| ORM | Drizzle ORM |
| データベース | PostgreSQL |
| 決済 | Stripe |
| スタイリング | Tailwind CSS 4 |
| バリデーション | Zod |
| キャッシュ | Redis (ioredis) |

### 設計方針

- **単一テーブル + JSON カラム方式**: カテゴリごとに型安全な JSONB カラムで設定値を保持
- **変更履歴**: 全設定変更を `ec_settings_history` テーブルに記録し巻き戻しを可能にする
- **キャッシュファースト**: 設定値の読み取りは Redis キャッシュ経由で高速化
- **Server Actions**: CRUD 操作は Next.js Server Actions で実装（REST API のボイラープレートを排除）
- **ADMIN 専用**: 全設定操作は ADMIN ロール必須

### システム構成図

```
┌──────────────┐     ┌───────────────────────────┐     ┌──────────────┐
│  管理者       │────▶│  Next.js 15 App Router     │────▶│  PostgreSQL  │
│  (ブラウザ)   │◀────│  Server Actions / API      │◀────│              │
└──────────────┘     └───────────────────────────┘     └──────────────┘
                              │          │
                     ┌────────┘          └────────┐
                     ▼                            ▼
              ┌─────────────┐            ┌──────────────┐
              │  Stripe API  │            │  Redis Cache  │
              │  (決済連携)   │            │  (設定キャッシュ) │
              └─────────────┘            └──────────────┘
```

---

## 2. 設定カテゴリ一覧

### 2.1 配送設定 (Shipping)

配送方法・送料・送料無料閾値・地域別追加送料を管理する。

#### 配送方法

| 配送方法 | コード | 配送業者 | 基本送料 | 目安日数 | デフォルト |
|---------|--------|---------|---------|---------|----------|
| 通常配送 | `standard` | ヤマト運輸 | 600円 | 3〜5営業日 | ON |
| 速達便 | `express` | ヤマト運輸 | 1,200円 | 1〜2営業日 | ON |

#### 送料無料ライン

| 項目 | 値 |
|------|-----|
| 送料無料しきい値 | 10,000円（税込） |
| 対象配送方法 | 全配送方法 |
| 条件 | 商品小計（税込）がしきい値以上で送料無料 |
| null の場合 | 送料無料なし |

#### 地域別追加送料

| 地域 | コード | 追加送料（通常） | 追加送料（速達） |
|------|--------|---------------|---------------|
| 北海道 | `hokkaido` | +400円 | +600円 |
| 東北 | `tohoku` | +0円 | +0円 |
| 関東 | `kanto` | +0円 | +0円 |
| 中部 | `chubu` | +0円 | +0円 |
| 近畿 | `kinki` | +0円 | +0円 |
| 中国 | `chugoku` | +0円 | +0円 |
| 四国 | `shikoku` | +0円 | +0円 |
| 九州 | `kyushu` | +200円 | +400円 |
| 沖縄 | `okinawa` | +800円 | +1,000円 |

#### 型定義

```typescript
// types/ec-settings.ts

type JapanRegion =
  | "hokkaido"
  | "tohoku"
  | "kanto"
  | "chubu"
  | "kinki"
  | "chugoku"
  | "shikoku"
  | "kyushu"
  | "okinawa";

type RegionRate = {
  region: JapanRegion;
  additionalCost: number; // 追加送料（円）
};

type ShippingMethod = {
  id: string;
  name: string;
  carrier: "yamato" | "sagawa" | "japanpost";
  baseCost: number;
  estimatedDays: { min: number; max: number };
  isEnabled: boolean;
  regions: RegionRate[];
};

type ShippingSettings = {
  methods: ShippingMethod[];
  freeShippingThreshold: number | null; // null = 送料無料なし
  defaultMethodId: string;
};
```

#### 送料計算ロジック

```typescript
import Decimal from "decimal.js";

function calculateShippingFee(
  subtotalWithTax: Decimal,
  method: ShippingMethod,
  region: JapanRegion,
  settings: ShippingSettings,
  hasFreeShippingCoupon: boolean,
): Decimal {
  // 送料無料クーポン適用
  if (hasFreeShippingCoupon) return new Decimal(0);

  // 送料無料ライン判定
  if (
    settings.freeShippingThreshold !== null &&
    subtotalWithTax.gte(settings.freeShippingThreshold)
  ) {
    return new Decimal(0);
  }

  // 基本送料 + 地域別追加送料
  const regionRate = method.regions.find((r) => r.region === region);
  const additionalCost = regionRate?.additionalCost ?? 0;

  return new Decimal(method.baseCost).plus(additionalCost);
}
```

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  配送設定                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  配送方法          配送業者     料金      有効     │
│  通常配送          [ヤマト▼]   ¥[600]   [✓]      │
│    目安日数: [3]〜[5] 営業日                      │
│  速達便            [ヤマト▼]   ¥[1,200] [✓]      │
│    目安日数: [1]〜[2] 営業日                      │
│                                                  │
│  [+ 配送方法を追加]                               │
│                                                  │
│  デフォルト配送方法: [通常配送 ▼]                  │
│  送料無料ライン:     ¥[10,000] [✓ 有効]           │
│                                                  │
│  ── 地域別追加送料（通常配送） ──                  │
│  北海道: ¥[400]  東北: ¥[0]    関東: ¥[0]        │
│  中部:   ¥[0]    近畿: ¥[0]    中国: ¥[0]        │
│  四国:   ¥[0]    九州: ¥[200]  沖縄: ¥[800]      │
│                                                  │
│  [設定を保存]                                     │
└──────────────────────────────────────────────────┘
```

---

### 2.2 税率設定 (Tax)

消費税の税率・表示方式・端数処理・インボイス設定を管理する。

#### 設定項目

| 項目 | フィールド | デフォルト値 | 説明 |
|------|-----------|-----------|------|
| 標準税率 | `standardRate` | 0.10 (10%) | 通常商品に適用 |
| 軽減税率 | `reducedRate` | 0.08 (8%) | 将来対応用（現在未使用） |
| 表示方式 | `priceDisplayMode` | `tax_inclusive` | 税込/税抜表示 |
| 端数処理 | `roundingMode` | `floor` | 切り捨て/四捨五入/切り上げ |
| インボイス番号 | `invoiceRegistrationNumber` | - | T + 13桁の数字 |
| 税計算単位 | `taxCalculationBase` | `per_item` | 商品単位/注文単位 |

#### 型定義

```typescript
type TaxSettings = {
  standardRate: number;        // 0.10 = 10%
  reducedRate: number;         // 0.08 = 8%
  priceDisplayMode: "tax_inclusive" | "tax_exclusive";
  roundingMode: "round" | "floor" | "ceil";
  invoiceRegistrationNumber: string; // T + 13桁
  taxCalculationBase: "per_item" | "per_order";
};
```

#### 税額計算

```typescript
import Decimal from "decimal.js";

const ROUNDING_MAP = {
  round: Decimal.ROUND_HALF_UP,
  floor: Decimal.ROUND_DOWN,
  ceil: Decimal.ROUND_UP,
} as const;

// 税込価格から税額を計算
function calculateTaxFromInclusive(
  priceWithTax: Decimal,
  config: TaxSettings,
): { taxAmount: Decimal; priceWithoutTax: Decimal } {
  const rate = new Decimal(config.standardRate);
  const rounding = ROUNDING_MAP[config.roundingMode];

  const taxAmount = priceWithTax
    .times(rate)
    .div(rate.plus(1))
    .toDecimalPlaces(0, rounding);

  return {
    taxAmount,
    priceWithoutTax: priceWithTax.minus(taxAmount),
  };
}

// 税抜価格から税込価格を計算
function calculateTaxExclusive(
  priceWithoutTax: Decimal,
  config: TaxSettings,
): { taxAmount: Decimal; priceWithTax: Decimal } {
  const rate = new Decimal(config.standardRate);
  const rounding = ROUNDING_MAP[config.roundingMode];

  const taxAmount = priceWithoutTax
    .times(rate)
    .toDecimalPlaces(0, rounding);

  return {
    taxAmount,
    priceWithTax: priceWithoutTax.plus(taxAmount),
  };
}
```

#### 表示フォーマット

| 表示モード | 表示例 |
|-----------|--------|
| 税込（デフォルト） | \8,800 (税込) |
| 税抜 | \8,000 (税抜) |

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  税率設定                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  消費税率:     [10] %                             │
│  軽減税率:     [8]  % （将来対応用）                │
│  表示方式:     (●) 税込表示  (○) 税抜表示          │
│  端数処理:     (●) 切り捨て  (○) 四捨五入  (○) 切上│
│  税計算単位:   (●) 商品単位  (○) 注文単位          │
│                                                  │
│  インボイス登録番号: [T             ]              │
│  ※ T + 13桁の数字                                │
│                                                  │
│  プレビュー:                                      │
│  商品価格 ¥8,000 の場合:                           │
│  税額: ¥800  税込価格: ¥8,800                     │
│                                                  │
│  [設定を保存]                                     │
└──────────────────────────────────────────────────┘
```

---

### 2.3 決済設定 (Payment)

Stripe を中心とした決済手段の有効化・Webhook・明細書表記を管理する。

#### 対応決済方法

| 決済方法 | Stripe メソッド | 説明 | デフォルト |
|---------|----------------|------|----------|
| クレジットカード | `card` | Visa / Mastercard / JCB / AMEX | ON |
| PayPay | `paypay` | PayPay オンライン決済 | ON |
| 銀行振込 | `customer_balance` | Stripe 経由の銀行振込 | OFF |
| コンビニ決済 | `konbini` | セブン-イレブン / ローソン / ファミリーマート等 | ON |

#### 型定義

```typescript
type PaymentMethodType = "card" | "paypay" | "customer_balance" | "konbini";

type PaymentMethodConfig = {
  type: PaymentMethodType;
  displayName: string;
  isEnabled: boolean;
  minAmount: number | null;  // 最小利用金額（円）、null = 制限なし
  maxAmount: number | null;  // 最大利用金額（円）、null = 制限なし
  sortOrder: number;         // 表示順
};

type StripeConfig = {
  isEnabled: boolean;
  publicKey: string;           // pk_test_ または pk_live_ で始まる
  webhookEndpoint: string;     // Webhook エンドポイントURL
  statementDescriptor: string; // 明細書表記（最大22文字、半角英数）
};

type PaymentSettings = {
  stripe: StripeConfig;
  paymentMethods: PaymentMethodConfig[];
  currency: "jpy";
};
```

> **注意**: Stripe の Secret Key (`sk_`) は環境変数 `STRIPE_SECRET_KEY` で管理し、DB には保存しない。

#### Stripe 連携

```typescript
// lib/stripe.ts

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

export async function createPaymentIntent(
  amount: number,
  metadata: Record<string, string>,
  paymentMethodTypes: PaymentMethodType[] = ["card"],
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount,
    currency: "jpy",
    payment_method_types: paymentMethodTypes,
    metadata,
  });
}

export async function handleStripeWebhook(
  body: string,
  signature: string,
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
      break;
  }
}
```

#### 決済方法ごとの利用上限

| 決済方法 | 最小金額 | 最大金額 |
|---------|---------|---------|
| クレジットカード | なし | なし |
| PayPay | なし | 500,000円 |
| 銀行振込 | 1,000円 | なし |
| コンビニ決済 | なし | 300,000円 |

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  決済設定                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ── Stripe 基本設定 ──                            │
│  Stripe 決済:     [✓ 有効]                        │
│  公開キー:        [pk_test_...              ]     │
│  Webhook URL:     [/api/webhooks/stripe      ]    │
│  明細書表記:      [KYARAINNOVATE             ]    │
│   ※ 半角英数22文字以内                            │
│                                                  │
│  ── 決済方法 ──                                   │
│  決済方法           ステータス  最小金額  最大金額   │
│  クレジットカード    [✓ ON]    [   ]    [     ]    │
│  PayPay            [✓ ON]    [   ]    [500000]    │
│  銀行振込           [□ OFF]   [1000]   [     ]    │
│  コンビニ決済       [✓ ON]    [   ]    [300000]   │
│                                                  │
│  表示順: [↑][↓] でドラッグ&ドロップ並び替え        │
│                                                  │
│  [設定を保存]                                     │
└──────────────────────────────────────────────────┘
```

#### Stripe テストモード

| 項目 | テスト | 本番 |
|------|--------|------|
| APIキー | `sk_test_...` | `sk_live_...` |
| 公開キー | `pk_test_...` | `pk_live_...` |
| Webhookシークレット | `whsec_test_...` | `whsec_live_...` |
| テストカード | `4242 4242 4242 4242` | 実カード |
| 環境変数 | `STRIPE_SECRET_KEY` | 同左 |

---

### 2.4 通知設定 (Notification)

メール通知のテンプレート・トリガー条件・送信設定を管理する。

#### 通知トリガー一覧

| トリガー | コード | 送信先 | タイミング | デフォルト |
|---------|--------|--------|-----------|----------|
| 注文確認 | `order_confirmed` | 顧客 | 注文完了時 | ON |
| 発送通知 | `order_shipped` | 顧客 | ステータス→SHIPPED時 | ON |
| 配送完了 | `order_delivered` | 顧客 | ステータス→DELIVERED時 | ON |
| レビューリクエスト | `review_request` | 顧客 | 配送完了後N日 | ON（7日後） |
| 注文キャンセル | `order_cancelled` | 顧客 | 注文キャンセル時 | ON |
| 管理者注文通知 | `admin_new_order` | 管理者 | 新規注文時 | ON |
| パスワードリセット | `password_reset` | ユーザー | リセット要求時 | ON |
| アカウント登録完了 | `account_registered` | ユーザー | 新規登録時 | ON |

#### メール送信基盤

| 項目 | 値 |
|------|-----|
| プロバイダー | Resend |
| テンプレート | React Email |
| 送信元 | `noreply@kyarainnovate.com` |
| 送信元名 | `KyaraInnovate` |
| 返信先 | `support@kyarainnovate.com` |

#### テンプレート変数

メールテンプレート内で `{{variableName}}` 形式で利用可能な変数:

| 変数 | 説明 | 利用可能トリガー |
|------|------|----------------|
| `{{customerName}}` | 顧客名 | 全トリガー |
| `{{orderNumber}}` | 注文番号 | 注文関連全般 |
| `{{orderTotal}}` | 注文合計金額 | 注文関連全般 |
| `{{orderDate}}` | 注文日 | 注文関連全般 |
| `{{fragranceName}}` | フレグランス名 | 注文関連全般 |
| `{{trackingNumber}}` | 追跡番号 | `order_shipped` |
| `{{carrierName}}` | 配送業者名 | `order_shipped` |
| `{{trackingUrl}}` | 追跡URL | `order_shipped` |
| `{{reviewUrl}}` | レビュー投稿URL | `review_request` |
| `{{resetUrl}}` | パスワードリセットURL | `password_reset` |
| `{{shopName}}` | ショップ名 | 全トリガー |

#### 型定義

```typescript
type NotificationTrigger =
  | "order_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "review_request"
  | "order_cancelled"
  | "admin_new_order"
  | "password_reset"
  | "account_registered";

type EmailTemplate = {
  trigger: NotificationTrigger;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isEnabled: boolean;
  variables: string[]; // 利用可能な変数名のリスト
};

type NotificationSettings = {
  emailFrom: string;
  emailFromName: string;
  replyTo: string;
  templates: EmailTemplate[];
  reviewRequestDelayDays: number; // レビューリクエスト送信遅延日数
};
```

#### メールテンプレート例（注文確認）

```typescript
// emails/order-confirmation.tsx

import {
  Html, Head, Body, Container, Section, Text, Hr,
} from "@react-email/components";

type OrderConfirmationProps = {
  customerName: string;
  orderId: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
};

export function OrderConfirmationEmail(props: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>{props.customerName} 様</Text>
          <Text>ご注文ありがとうございます。</Text>
          <Text>注文番号: {props.orderId}</Text>
          <Hr />
          <Section>
            {props.items.map((item) => (
              <Text key={item.name}>
                {item.name} x{item.quantity} \{item.price.toLocaleString()}
              </Text>
            ))}
          </Section>
          <Hr />
          <Text>小計: \{props.subtotal.toLocaleString()}</Text>
          <Text>送料: \{props.shippingFee.toLocaleString()}</Text>
          {props.discount > 0 && (
            <Text>割引: -\{props.discount.toLocaleString()}</Text>
          )}
          <Text>合計: \{props.total.toLocaleString()}</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  通知設定                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ── 送信設定 ──                                   │
│  送信元アドレス: [noreply@kyarainnovate.com]       │
│  送信元名:       [KyaraInnovate]                  │
│  返信先:         [support@kyarainnovate.com]      │
│                                                  │
│  ── 顧客向け通知 ──                               │
│  注文確認メール:        [✓ ON]  [テンプレート編集]  │
│  発送通知メール:        [✓ ON]  [テンプレート編集]  │
│  配送完了メール:        [✓ ON]  [テンプレート編集]  │
│  レビュー依頼メール:    [✓ ON]  送信: 配送完了 [7]日後│
│  注文キャンセル:        [✓ ON]  [テンプレート編集]  │
│                                                  │
│  ── 管理者向け通知 ──                              │
│  新規注文通知:          [✓ ON]  [テンプレート編集]  │
│                                                  │
│  ── アカウント関連 ──                              │
│  パスワードリセット:    [✓ ON]  [テンプレート編集]  │
│  アカウント登録完了:    [✓ ON]  [テンプレート編集]  │
│                                                  │
│  [テストメール送信]  [設定を保存]                   │
└──────────────────────────────────────────────────┘
```

---

### 2.5 ロイヤリティ設定 (Royalty)

クリエイター（香り調合師/レシピ作成者）へのロイヤリティ率と振込スケジュールを管理する。

> 詳細な計算ロジック・月次集計は [royalty-system.md](./royalty-system.md) を参照

#### ティア別ロイヤリティ率

クリエイターティア（5段階）に連動したロイヤリティ率を管理画面から設定変更可能にする。

> **注記**: ティアの昇格条件・スコア計算は [creator-system.md §7](./creator-system.md) を参照。ここでは管理者が各ティアのロイヤリティ率を調整するための設定を定義する。

| ティア | コード | 表示名 | ロイヤリティ率（デフォルト） |
|--------|------|------|--------------------------|
| T1 | `APPRENTICE` | アプレンティス | 10% |
| T2 | `ARTISAN` | アルチザン | 12% |
| T3 | `EXPERT` | エキスパート | 15% |
| T4 | `MASTER` | マスター | 18% |
| T5 | `GRAND_MASTER` | グランドマスター | 20% |

#### 設定項目

| 項目 | フィールド | デフォルト値 | 説明 |
|------|-----------|-----------|------|
| ティア定義 | `tiers` | 上記5ティア | クリエイターティアごとの料率 |
| 振込スケジュール | `payoutSchedule` | `monthly` | 月次/隔週 |
| 最低振込金額 | `payoutMinimumAmount` | 5,000円 | この金額未満は翌月繰越 |
| 振込日 | `payoutDay` | 25日 | 月の何日に振込 (1-28) |
| 計算基準 | `calculationBase` | `net_sales` | 税抜売上/税込売上 |
| 有効/無効 | `isEnabled` | true | ロイヤリティ機能の ON/OFF |

#### 型定義

```typescript
type RoyaltyTierName = "APPRENTICE" | "ARTISAN" | "EXPERT" | "MASTER" | "GRAND_MASTER";

type RoyaltyTierConfig = {
  tier: RoyaltyTierName;
  displayName: string;
  royaltyRate: number;  // 0.10 = 10%
};

type RoyaltySettings = {
  tiers: RoyaltyTierConfig[];
  payoutSchedule: "monthly" | "biweekly";
  payoutMinimumAmount: number;
  payoutDay: number;             // 1-28
  calculationBase: "net_sales" | "gross_sales";
  isEnabled: boolean;
};
```

#### ロイヤリティ計算例

```typescript
import Decimal from "decimal.js";

function calculateRoyalty(
  orderAmountExcludingTax: number,
  tier: RoyaltyTierConfig,
  settings: RoyaltySettings,
): Decimal {
  const base =
    settings.calculationBase === "net_sales"
      ? orderAmountExcludingTax
      : orderAmountExcludingTax; // gross_sales の場合は税込金額を渡す

  return new Decimal(base)
    .times(tier.royaltyRate)
    .toDecimalPlaces(0, Decimal.ROUND_DOWN);
}

// 例: APPRENTICE ティア、税抜 ¥8,000 の注文
// ¥8,000 * 0.10 = ¥800
```

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  ロイヤリティ設定                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ロイヤリティ機能: [✓ 有効]                        │
│                                                  │
│  ── ティア別ロイヤリティ率 ──                       │
│  ※ ティア昇格条件は creator-system.md §7 を参照    │
│  ┌───────────────────────────────────────────┐   │
│  │ ティア          │ コード       │ 率       │   │
│  │────────────────│────────────│─────────│   │
│  │ アプレンティス   │ APPRENTICE  │ [10] %  │   │
│  │ アルチザン       │ ARTISAN     │ [12] %  │   │
│  │ エキスパート     │ EXPERT      │ [15] %  │   │
│  │ マスター         │ MASTER      │ [18] %  │   │
│  │ グランドマスター  │ GRAND_MASTER│ [20] %  │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ── 振込設定 ──                                   │
│  振込スケジュール: (●) 月次  (○) 隔週              │
│  振込日:           毎月 [25] 日                    │
│  最低振込金額:     ¥[5,000]                        │
│  計算基準:         (●) 税抜売上  (○) 税込売上       │
│                                                  │
│  [設定を保存]                                     │
└──────────────────────────────────────────────────┘
```

---

### 2.6 サイト設定 (Site)

メンテナンスモード・お知らせバナー・サイト基本情報を管理する。

#### 設定項目

| 項目 | フィールド | デフォルト値 | 説明 |
|------|-----------|-----------|------|
| メンテナンスモード | `maintenanceMode.isEnabled` | false | ON にすると一般ユーザーはアクセス不可 |
| メンテナンスメッセージ | `maintenanceMode.message` | (下記参照) | メンテナンス中の表示テキスト |
| 許可IP | `maintenanceMode.allowedIPs` | [] | メンテナンス中もアクセスを許可するIPアドレス |
| 終了予定日時 | `maintenanceMode.scheduledEnd` | null | ISO 8601 形式、null = 未定 |
| バナー表示 | `announcement.isEnabled` | false | ON にするとサイト上部にバナー表示 |
| バナーメッセージ | `announcement.message` | "" | バナーに表示するテキスト |
| バナー種別 | `announcement.type` | `info` | info / warning / success |
| バナーリンク | `announcement.linkUrl` | null | バナー内のリンクURL（任意） |
| 閉じるボタン | `announcement.dismissible` | true | ユーザーがバナーを閉じられるか |
| サイト名 | `siteName` | "KyaraInnovate" | サイト全体の名称 |
| サイト説明 | `siteDescription` | (下記参照) | SEO用のメタディスクリプション |
| 問い合わせメール | `contactEmail` | `support@kyarainnovate.com` | 問い合わせ用メールアドレス |

#### 型定義

```typescript
type MaintenanceMode = {
  isEnabled: boolean;
  message: string;
  allowedIPs: string[];
  scheduledEnd: string | null; // ISO 8601
};

type AnnouncementBanner = {
  isEnabled: boolean;
  message: string;
  type: "info" | "warning" | "success";
  linkUrl: string | null;
  linkText: string | null;
  dismissible: boolean;
};

type SiteSettings = {
  maintenanceMode: MaintenanceMode;
  announcement: AnnouncementBanner;
  siteName: string;
  siteDescription: string;
  contactEmail: string;
};
```

#### 管理画面

```
┌──────────────────────────────────────────────────┐
│  サイト設定                                       │
├──────────────────────────────────────────────────┤
│                                                  │
│  ── メンテナンスモード ──                          │
│  メンテナンスモード: [□ OFF]                       │
│  ⚠ ON にすると一般ユーザーはサイトにアクセスできなく │
│  なります。管理者は引き続きアクセス可能です。        │
│  メッセージ:                                      │
│  [ただいまメンテナンス中です。              ]       │
│  終了予定日時: [                    ]              │
│  許可IP:      [追加...]                           │
│                                                  │
│  ── お知らせバナー ──                              │
│  バナー表示: [□ OFF]                               │
│  メッセージ: [                              ]      │
│  種別: (●) お知らせ  (○) 警告  (○) 完了           │
│  リンクURL:  [                    ]               │
│  リンクテキスト: [                 ]               │
│  閉じるボタン: [✓ 表示]                            │
│                                                  │
│  ── サイト基本情報 ──                              │
│  サイト名:   [KyaraInnovate                ]      │
│  説明文:     [あなただけのオリジナルフレグランス...]  │
│  問い合わせ: [support@kyarainnovate.com     ]     │
│                                                  │
│  [設定を保存]                                     │
└──────────────────────────────────────────────────┘
```

---

## 3. DBスキーマ設計

### 3.1 テーブル構成

カテゴリごとに型付き JSONB カラムを持つ `ec_settings` テーブルと、変更履歴を記録する `ec_settings_history` テーブルの2テーブル構成。

### 3.2 ec_settings テーブル

```typescript
// packages/db/src/schema/ec-settings.ts

import {
  pgTable, text, jsonb, timestamp, integer, boolean,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import type {
  ShippingSettings,
  TaxSettings,
  PaymentSettings,
  NotificationSettings,
  RoyaltySettings,
  SiteSettings,
} from "@/types/ec-settings";

export const ecSettings = pgTable("ec_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  // 設定カテゴリごとの JSONB カラム
  shipping: jsonb("shipping").$type<ShippingSettings>().notNull(),
  tax: jsonb("tax").$type<TaxSettings>().notNull(),
  payment: jsonb("payment").$type<PaymentSettings>().notNull(),
  notification: jsonb("notification").$type<NotificationSettings>().notNull(),
  royalty: jsonb("royalty").$type<RoyaltySettings>().notNull(),
  site: jsonb("site").$type<SiteSettings>().notNull(),

  // メタデータ
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),

  // タイムスタンプ
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type EcSettings = typeof ecSettings.$inferSelect;
export type NewEcSettings = typeof ecSettings.$inferInsert;
```

### 3.3 ec_settings_history テーブル

```typescript
// packages/db/src/schema/ec-settings-history.ts

import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { ecSettings } from "./ec-settings";

export const ecSettingsHistory = pgTable("ec_settings_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  // 変更対象
  settingsId: text("settings_id")
    .notNull()
    .references(() => ecSettings.id),
  category: text("category", {
    enum: ["shipping", "tax", "payment", "notification", "royalty", "site"],
  }).notNull(),

  // 変更内容
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value").notNull(),
  changeDescription: text("change_description"),

  // 変更者
  changedBy: text("changed_by").notNull(), // 管理者ユーザーID
  version: integer("version").notNull(),

  // タイムスタンプ
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EcSettingsHistory = typeof ecSettingsHistory.$inferSelect;
```

### 3.4 ER図

```
┌─────────────────────────────┐
│        ec_settings          │
├─────────────────────────────┤
│ id          TEXT PK         │
│ shipping    JSONB NOT NULL  │
│ tax         JSONB NOT NULL  │
│ payment     JSONB NOT NULL  │
│ notification JSONB NOT NULL │
│ royalty     JSONB NOT NULL  │
│ site        JSONB NOT NULL  │
│ version     INT  NOT NULL   │
│ is_active   BOOL NOT NULL   │
│ created_at  TIMESTAMPTZ     │
│ updated_at  TIMESTAMPTZ     │
└──────────────┬──────────────┘
               │ 1
               │
               │ N
┌──────────────┴──────────────┐
│    ec_settings_history      │
├─────────────────────────────┤
│ id               TEXT PK    │
│ settings_id      TEXT FK    │
│ category         TEXT       │
│ previous_value   JSONB      │
│ new_value        JSONB      │
│ change_description TEXT     │
│ changed_by       TEXT       │
│ version          INT        │
│ created_at       TIMESTAMPTZ│
└─────────────────────────────┘
```

### 3.5 マイグレーション

```sql
-- drizzle/migrations/0001_create_ec_settings.sql

CREATE TABLE IF NOT EXISTS ec_settings (
  id TEXT PRIMARY KEY,
  shipping JSONB NOT NULL,
  tax JSONB NOT NULL,
  payment JSONB NOT NULL,
  notification JSONB NOT NULL,
  royalty JSONB NOT NULL,
  site JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ec_settings_history (
  id TEXT PRIMARY KEY,
  settings_id TEXT NOT NULL REFERENCES ec_settings(id),
  category TEXT NOT NULL CHECK (category IN (
    'shipping', 'tax', 'payment', 'notification', 'royalty', 'site'
  )),
  previous_value JSONB,
  new_value JSONB NOT NULL,
  change_description TEXT,
  changed_by TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ec_settings_active ON ec_settings(is_active);
CREATE INDEX idx_ec_settings_history_settings_id ON ec_settings_history(settings_id);
CREATE INDEX idx_ec_settings_history_category ON ec_settings_history(category);
CREATE INDEX idx_ec_settings_history_created_at ON ec_settings_history(created_at);
```

---

## 4. APIエンドポイント設計

すべての設定操作は Next.js Server Actions で実装する。REST API のボイラープレートを排除し、管理画面のフォーム送信とサーバーサイドのデータ操作を直接接続する。

### 4.1 Server Actions 一覧

| アクション | ファイル | 説明 |
|-----------|---------|------|
| `getEcSettings` | `actions/ec-settings/get.ts` | 現在のアクティブ設定を全カテゴリ取得 |
| `getSettingsByCategory` | `actions/ec-settings/get.ts` | カテゴリ指定で設定を取得 |
| `updateShippingSettings` | `actions/ec-settings/shipping.ts` | 配送設定を更新 |
| `updateTaxSettings` | `actions/ec-settings/tax.ts` | 税率設定を更新 |
| `updatePaymentSettings` | `actions/ec-settings/payment.ts` | 決済設定を更新 |
| `updateNotificationSettings` | `actions/ec-settings/notification.ts` | 通知設定を更新 |
| `updateRoyaltySettings` | `actions/ec-settings/royalty.ts` | ロイヤリティ設定を更新 |
| `updateSiteSettings` | `actions/ec-settings/site.ts` | サイト設定を更新 |
| `getSettingsHistory` | `actions/ec-settings/history.ts` | 設定変更履歴を取得 |
| `revertSettings` | `actions/ec-settings/history.ts` | 指定バージョンの設定に巻き戻し |

### 4.2 設定取得

```typescript
// src/actions/ec-settings/get.ts
"use server";

import { db } from "@/db";
import { ecSettings } from "@/db/schema/ec-settings";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { settingsCache } from "@/lib/cache/settings";
import type { SettingsCategory } from "@/types/ec-settings";

export async function getEcSettings() {
  await requireAdmin();

  // キャッシュから取得を試行
  const cached = await settingsCache.get<EcSettings>("active_settings");
  if (cached) return { success: true as const, data: cached };

  const [settings] = await db
    .select()
    .from(ecSettings)
    .where(eq(ecSettings.isActive, true))
    .limit(1);

  if (!settings) {
    return { success: false as const, error: "設定が見つかりません" };
  }

  await settingsCache.set("active_settings", settings);

  return { success: true as const, data: settings };
}

export async function getSettingsByCategory<T>(category: SettingsCategory) {
  await requireAdmin();

  const cacheKey = `settings:${category}`;
  const cached = await settingsCache.get<T>(cacheKey);
  if (cached) return { success: true as const, data: cached };

  const [settings] = await db
    .select()
    .from(ecSettings)
    .where(eq(ecSettings.isActive, true))
    .limit(1);

  if (!settings) {
    return { success: false as const, error: "設定が見つかりません" };
  }

  const categoryData = settings[category] as T;
  await settingsCache.set(cacheKey, categoryData);

  return { success: true as const, data: categoryData };
}
```

### 4.3 設定更新（共通パターン）

```typescript
// src/actions/ec-settings/shipping.ts
"use server";

import { db } from "@/db";
import { ecSettings } from "@/db/schema/ec-settings";
import { ecSettingsHistory } from "@/db/schema/ec-settings-history";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { shippingSettingsSchema } from "@/lib/validations/ec-settings";
import { settingsCache } from "@/lib/cache/settings";
import type { ShippingSettings } from "@/types/ec-settings";

export async function updateShippingSettings(formData: ShippingSettings) {
  const admin = await requireAdmin();

  // 1. バリデーション
  const validated = shippingSettingsSchema.safeParse(formData);
  if (!validated.success) {
    return {
      success: false as const,
      error: "入力内容に誤りがあります",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  // 2. 現在の設定を取得
  const [current] = await db
    .select()
    .from(ecSettings)
    .where(eq(ecSettings.isActive, true))
    .limit(1);

  if (!current) {
    return { success: false as const, error: "設定が見つかりません" };
  }

  // 3. トランザクションで更新 + 履歴記録
  await db.transaction(async (tx) => {
    await tx
      .update(ecSettings)
      .set({
        shipping: validated.data,
        version: sql`${ecSettings.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(ecSettings.id, current.id));

    await tx.insert(ecSettingsHistory).values({
      settingsId: current.id,
      category: "shipping",
      previousValue: current.shipping,
      newValue: validated.data,
      changeDescription: "配送設定を更新",
      changedBy: admin.id,
      version: current.version + 1,
    });
  });

  // 4. キャッシュ無効化
  await settingsCache.invalidate("active_settings");
  await settingsCache.invalidate("settings:shipping");

  // 5. ページ再検証
  revalidatePath("/admin/settings");

  return { success: true as const };
}
```

> 他カテゴリ（tax / payment / notification / royalty / site）も同様のパターンで実装する。カテゴリ名・スキーマ・フィールド名のみが異なる。

### 4.4 変更履歴・巻き戻し

```typescript
// src/actions/ec-settings/history.ts
"use server";

import { db } from "@/db";
import { ecSettings } from "@/db/schema/ec-settings";
import { ecSettingsHistory } from "@/db/schema/ec-settings-history";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { settingsCache } from "@/lib/cache/settings";
import type { SettingsCategory } from "@/types/ec-settings";

export async function getSettingsHistory(
  category?: SettingsCategory,
  limit = 50,
) {
  await requireAdmin();

  const conditions = category
    ? eq(ecSettingsHistory.category, category)
    : undefined;

  const history = await db
    .select()
    .from(ecSettingsHistory)
    .where(conditions)
    .orderBy(desc(ecSettingsHistory.createdAt))
    .limit(limit);

  return { success: true as const, data: history };
}

export async function revertSettings(historyId: string) {
  const admin = await requireAdmin();

  const [historyRecord] = await db
    .select()
    .from(ecSettingsHistory)
    .where(eq(ecSettingsHistory.id, historyId))
    .limit(1);

  if (!historyRecord || !historyRecord.previousValue) {
    return { success: false as const, error: "巻き戻し対象が見つかりません" };
  }

  const [current] = await db
    .select()
    .from(ecSettings)
    .where(eq(ecSettings.isActive, true))
    .limit(1);

  if (!current) {
    return { success: false as const, error: "設定が見つかりません" };
  }

  const category = historyRecord.category as SettingsCategory;

  await db.transaction(async (tx) => {
    await tx
      .update(ecSettings)
      .set({
        [category]: historyRecord.previousValue,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(ecSettings.id, current.id));

    await tx.insert(ecSettingsHistory).values({
      settingsId: current.id,
      category,
      previousValue: current[category],
      newValue: historyRecord.previousValue,
      changeDescription: `バージョン ${historyRecord.version} に巻き戻し`,
      changedBy: admin.id,
      version: current.version + 1,
    });
  });

  await settingsCache.invalidateAll();
  revalidatePath("/admin/settings");

  return { success: true as const };
}
```

### 4.5 ファイル構成

```
src/
├── actions/
│   └── ec-settings/
│       ├── get.ts              # 設定取得
│       ├── shipping.ts         # 配送設定更新
│       ├── tax.ts              # 税率設定更新
│       ├── payment.ts          # 決済設定更新
│       ├── notification.ts     # 通知設定更新
│       ├── royalty.ts          # ロイヤリティ設定更新
│       ├── site.ts             # サイト設定更新
│       └── history.ts          # 変更履歴・巻き戻し
├── app/
│   └── admin/
│       └── settings/
│           ├── page.tsx        # 設定管理メインページ
│           └── layout.tsx      # 設定管理レイアウト
├── components/
│   └── admin/
│       └── settings/
│           ├── settings-tabs.tsx
│           ├── shipping-form.tsx
│           ├── tax-form.tsx
│           ├── payment-form.tsx
│           ├── notification-form.tsx
│           ├── royalty-form.tsx
│           ├── site-form.tsx
│           └── history-table.tsx
├── db/
│   └── schema/
│       ├── ec-settings.ts
│       └── ec-settings-history.ts
├── lib/
│   ├── cache/
│   │   └── settings.ts
│   └── validations/
│       └── ec-settings.ts
└── types/
    └── ec-settings.ts
```

---

## 5. バリデーション

### 5.1 Zod スキーマ

```typescript
// src/lib/validations/ec-settings.ts

import { z } from "zod";

// ============================================================
// 共通
// ============================================================

const japanRegionSchema = z.enum([
  "hokkaido", "tohoku", "kanto", "chubu", "kinki",
  "chugoku", "shikoku", "kyushu", "okinawa",
]);

// ============================================================
// 配送設定
// ============================================================

const regionRateSchema = z.object({
  region: japanRegionSchema,
  additionalCost: z
    .number()
    .int("追加送料は整数で指定してください")
    .min(0, "追加送料は0円以上で指定してください"),
});

const shippingMethodSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  name: z
    .string()
    .min(1, "配送方法名は必須です")
    .max(50, "50文字以内で入力してください"),
  carrier: z.enum(["yamato", "sagawa", "japanpost"], {
    errorMap: () => ({ message: "有効な配送業者を選択してください" }),
  }),
  baseCost: z
    .number()
    .int("基本送料は整数で指定してください")
    .min(0, "基本送料は0円以上で指定してください"),
  estimatedDays: z
    .object({
      min: z.number().int().min(1, "最短日数は1日以上で指定してください"),
      max: z.number().int().min(1, "最長日数は1日以上で指定してください"),
    })
    .refine((d) => d.max >= d.min, {
      message: "最長日数は最短日数以上にしてください",
    }),
  isEnabled: z.boolean(),
  regions: z.array(regionRateSchema),
});

export const shippingSettingsSchema = z
  .object({
    methods: z
      .array(shippingMethodSchema)
      .min(1, "配送方法を1つ以上設定してください"),
    freeShippingThreshold: z
      .number()
      .int("送料無料閾値は整数で指定してください")
      .min(0, "送料無料閾値は0円以上で指定してください")
      .nullable(),
    defaultMethodId: z.string().min(1, "デフォルト配送方法を選択してください"),
  })
  .refine(
    (data) => data.methods.some((m) => m.id === data.defaultMethodId),
    { message: "デフォルト配送方法は配送方法リストに含まれている必要があります" },
  )
  .refine(
    (data) => data.methods.some((m) => m.isEnabled),
    { message: "有効な配送方法が1つ以上必要です" },
  );

// ============================================================
// 税率設定
// ============================================================

export const taxSettingsSchema = z.object({
  standardRate: z
    .number()
    .min(0, "標準税率は0以上で指定してください")
    .max(1, "標準税率は1以下で指定してください"),
  reducedRate: z
    .number()
    .min(0, "軽減税率は0以上で指定してください")
    .max(1, "軽減税率は1以下で指定してください"),
  priceDisplayMode: z.enum(["tax_inclusive", "tax_exclusive"]),
  roundingMode: z.enum(["round", "floor", "ceil"]),
  invoiceRegistrationNumber: z
    .string()
    .regex(
      /^T\d{13}$/,
      "インボイス登録番号はT + 13桁の数字で入力してください",
    ),
  taxCalculationBase: z.enum(["per_item", "per_order"]),
});

// ============================================================
// 決済設定
// ============================================================

const paymentMethodConfigSchema = z
  .object({
    type: z.enum(["card", "paypay", "customer_balance", "konbini"]),
    displayName: z.string().min(1, "表示名は必須です"),
    isEnabled: z.boolean(),
    minAmount: z
      .number()
      .int()
      .min(0, "最小利用金額は0円以上で指定してください")
      .nullable(),
    maxAmount: z
      .number()
      .int()
      .min(0, "最大利用金額は0円以上で指定してください")
      .nullable(),
    sortOrder: z.number().int().min(0),
  })
  .refine(
    (data) => {
      if (data.minAmount !== null && data.maxAmount !== null) {
        return data.maxAmount >= data.minAmount;
      }
      return true;
    },
    { message: "最大利用金額は最小利用金額以上にしてください" },
  );

const stripeConfigSchema = z.object({
  isEnabled: z.boolean(),
  publicKey: z
    .string()
    .regex(
      /^pk_(test|live)_/,
      "Stripeの公開キーはpk_test_またはpk_live_で始まる必要があります",
    ),
  webhookEndpoint: z.string().url("有効なURLを入力してください"),
  statementDescriptor: z
    .string()
    .max(22, "明細書表記は22文字以内で入力してください")
    .regex(
      /^[a-zA-Z0-9 ]*$/,
      "明細書表記は半角英数字とスペースのみ使用できます",
    ),
});

export const paymentSettingsSchema = z
  .object({
    stripe: stripeConfigSchema,
    paymentMethods: z
      .array(paymentMethodConfigSchema)
      .min(1, "決済手段を1つ以上設定してください"),
    currency: z.literal("jpy"),
  })
  .refine(
    (data) => data.paymentMethods.some((m) => m.isEnabled),
    { message: "有効な決済手段が1つ以上必要です" },
  );

// ============================================================
// 通知設定
// ============================================================

const notificationTriggerSchema = z.enum([
  "order_confirmed",
  "order_shipped",
  "order_delivered",
  "review_request",
  "order_cancelled",
  "admin_new_order",
  "password_reset",
  "account_registered",
]);

const emailTemplateSchema = z.object({
  trigger: notificationTriggerSchema,
  subject: z
    .string()
    .min(1, "件名は必須です")
    .max(200, "件名は200文字以内で入力してください"),
  bodyHtml: z.string().min(1, "HTMLテンプレートは必須です"),
  bodyText: z.string().min(1, "テキストテンプレートは必須です"),
  isEnabled: z.boolean(),
  variables: z.array(z.string()),
});

export const notificationSettingsSchema = z.object({
  emailFrom: z.string().email("有効なメールアドレスを入力してください"),
  emailFromName: z.string().min(1, "送信元名は必須です"),
  replyTo: z.string().email("有効なメールアドレスを入力してください"),
  templates: z.array(emailTemplateSchema),
  reviewRequestDelayDays: z
    .number()
    .int("日数は整数で指定してください")
    .min(1, "レビューリクエストは1日以上に設定してください")
    .max(30, "レビューリクエストは30日以内に設定してください"),
});

// ============================================================
// ロイヤリティ設定
// ============================================================

const ROYALTY_TIER_NAMES = ["APPRENTICE", "ARTISAN", "EXPERT", "MASTER", "GRAND_MASTER"] as const;

const royaltyTierSchema = z.object({
  tier: z.enum(ROYALTY_TIER_NAMES),
  displayName: z.string().min(1, "表示名は必須です"),
  royaltyRate: z
    .number()
    .min(0, "ロイヤリティ率は0以上で指定してください")
    .max(1, "ロイヤリティ率は1以下で指定してください"),
});

export const royaltySettingsSchema = z
  .object({
    tiers: z
      .array(royaltyTierSchema)
      .length(5, "ティアは5段階すべて設定してください"),
    payoutSchedule: z.enum(["monthly", "biweekly"]),
    payoutMinimumAmount: z
      .number()
      .int("最低振込金額は整数で指定してください")
      .min(1, "最低振込金額は1円以上で指定してください"),
    payoutDay: z
      .number()
      .int()
      .min(1, "振込日は1以上で指定してください")
      .max(28, "振込日は28以下で指定してください"),
    calculationBase: z.enum(["net_sales", "gross_sales"]),
    isEnabled: z.boolean(),
  })
  .refine(
    (data) => {
      const tierNames = data.tiers.map((t) => t.tier);
      return ROYALTY_TIER_NAMES.every((name) => tierNames.includes(name));
    },
    { message: "すべてのクリエイターティア（APPRENTICE〜GRAND_MASTER）を定義してください" },
  );

// ============================================================
// サイト設定
// ============================================================

const maintenanceModeSchema = z.object({
  isEnabled: z.boolean(),
  message: z.string().min(1, "メンテナンスメッセージは必須です"),
  allowedIPs: z.array(
    z.string().ip({ message: "有効なIPアドレスを入力してください" }),
  ),
  scheduledEnd: z
    .string()
    .datetime({ message: "有効なISO 8601形式の日時を入力してください" })
    .nullable(),
});

const announcementBannerSchema = z.object({
  isEnabled: z.boolean(),
  message: z.string().min(1, "バナーメッセージは必須です"),
  type: z.enum(["info", "warning", "success"]),
  linkUrl: z.string().url("有効なURLを入力してください").nullable(),
  linkText: z.string().nullable(),
  dismissible: z.boolean(),
});

export const siteSettingsSchema = z.object({
  maintenanceMode: maintenanceModeSchema,
  announcement: announcementBannerSchema,
  siteName: z.string().min(1, "サイト名は必須です"),
  siteDescription: z
    .string()
    .max(300, "説明文は300文字以内で入力してください"),
  contactEmail: z.string().email("有効なメールアドレスを入力してください"),
});

// ============================================================
// 全設定スキーマ（一括バリデーション用）
// ============================================================

export const ecSettingsSchema = z.object({
  shipping: shippingSettingsSchema,
  tax: taxSettingsSchema,
  payment: paymentSettingsSchema,
  notification: notificationSettingsSchema,
  royalty: royaltySettingsSchema,
  site: siteSettingsSchema,
});
```

### 5.2 バリデーションルールまとめ

| カテゴリ | ルール |
|---------|--------|
| 配送 | 有効な配送方法が1つ以上必要 / デフォルトは methods に含まれている必要あり / 最長日数 >= 最短日数 |
| 税率 | 税率は 0〜1 の範囲 / インボイス番号は T + 13桁 |
| 決済 | 有効な決済手段が1つ以上必要 / 公開キーは pk_ で始まる / 最大金額 >= 最小金額 |
| 通知 | メールアドレスは有効な形式 / 件名は200文字以内 / レビュー遅延は1〜30日 |
| ロイヤリティ | ティア範囲に隙間や重複がない / 振込日は1〜28日 / ロイヤリティ率は 0〜1 |
| サイト | IPアドレスは有効な形式 / 日時はISO 8601 / 説明文は300文字以内 |

---

## 6. 管理画面UI仕様

### 6.1 ページ構成

```
/admin/settings
├── タブ: 配送設定
├── タブ: 税率設定
├── タブ: 決済設定
├── タブ: 通知設定
├── タブ: ロイヤリティ
├── タブ: サイト設定
└── タブ: 変更履歴
```

### 6.2 メインページ

```typescript
// src/app/admin/settings/page.tsx

import { Suspense } from "react";
import { getEcSettings } from "@/actions/ec-settings/get";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AdminSettingsPage() {
  const result = await getEcSettings();

  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <p className="text-red-600">設定の読み込みに失敗しました。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">EC設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          ストアの各種設定を管理します。変更は保存後すぐに反映されます。
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SettingsTabs settings={result.data} />
      </Suspense>
    </div>
  );
}
```

### 6.3 タブコンポーネント

```typescript
// src/components/admin/settings/settings-tabs.tsx
"use client";

import { useState } from "react";
import type { EcSettings } from "@/db/schema/ec-settings";
import { ShippingForm } from "./shipping-form";
import { TaxForm } from "./tax-form";
import { PaymentForm } from "./payment-form";
import { NotificationForm } from "./notification-form";
import { RoyaltyForm } from "./royalty-form";
import { SiteForm } from "./site-form";
import { HistoryTable } from "./history-table";

const tabs = [
  { id: "shipping", label: "配送設定" },
  { id: "tax", label: "税率設定" },
  { id: "payment", label: "決済設定" },
  { id: "notification", label: "通知設定" },
  { id: "royalty", label: "ロイヤリティ" },
  { id: "site", label: "サイト設定" },
  { id: "history", label: "変更履歴" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsTabs({ settings }: { settings: EcSettings }) {
  const [activeTab, setActiveTab] = useState<TabId>("shipping");

  return (
    <div>
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="設定タブ">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* タブコンテンツ */}
      <div className="mt-8">
        {activeTab === "shipping" && <ShippingForm initialData={settings.shipping} />}
        {activeTab === "tax" && <TaxForm initialData={settings.tax} />}
        {activeTab === "payment" && <PaymentForm initialData={settings.payment} />}
        {activeTab === "notification" && <NotificationForm initialData={settings.notification} />}
        {activeTab === "royalty" && <RoyaltyForm initialData={settings.royalty} />}
        {activeTab === "site" && <SiteForm initialData={settings.site} />}
        {activeTab === "history" && <HistoryTable />}
      </div>
    </div>
  );
}
```

### 6.4 フォームコンポーネント例（サイト設定）

```typescript
// src/components/admin/settings/site-form.tsx
"use client";

import { useActionState } from "react";
import { updateSiteSettings } from "@/actions/ec-settings/site";
import type { SiteSettings } from "@/types/ec-settings";

export function SiteForm({ initialData }: { initialData: SiteSettings }) {
  const [state, formAction, isPending] = useActionState(
    updateSiteSettings,
    { success: false, error: null },
  );

  return (
    <form action={formAction} className="space-y-8">
      {/* メンテナンスモード */}
      <fieldset className="rounded-lg border border-gray-200 p-6">
        <legend className="px-2 text-lg font-semibold text-gray-900">
          メンテナンスモード
        </legend>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="maintenance-enabled" className="text-sm font-medium text-gray-700">
              メンテナンスモードを有効にする
            </label>
            <input
              type="checkbox"
              id="maintenance-enabled"
              name="maintenanceMode.isEnabled"
              defaultChecked={initialData.maintenanceMode.isEnabled}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="maintenance-message" className="block text-sm font-medium text-gray-700">
              メンテナンスメッセージ
            </label>
            <textarea
              id="maintenance-message"
              name="maintenanceMode.message"
              defaultValue={initialData.maintenanceMode.message}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="maintenance-end" className="block text-sm font-medium text-gray-700">
              終了予定日時
            </label>
            <input
              type="datetime-local"
              id="maintenance-end"
              name="maintenanceMode.scheduledEnd"
              defaultValue={
                initialData.maintenanceMode.scheduledEnd?.slice(0, 16) ?? ""
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* お知らせバナー */}
      <fieldset className="rounded-lg border border-gray-200 p-6">
        <legend className="px-2 text-lg font-semibold text-gray-900">
          お知らせバナー
        </legend>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="announcement-enabled" className="text-sm font-medium text-gray-700">
              バナーを表示する
            </label>
            <input
              type="checkbox"
              id="announcement-enabled"
              name="announcement.isEnabled"
              defaultChecked={initialData.announcement.isEnabled}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="announcement-message" className="block text-sm font-medium text-gray-700">
              メッセージ
            </label>
            <input
              type="text"
              id="announcement-message"
              name="announcement.message"
              defaultValue={initialData.announcement.message}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="announcement-type" className="block text-sm font-medium text-gray-700">
              バナー種別
            </label>
            <select
              id="announcement-type"
              name="announcement.type"
              defaultValue={initialData.announcement.type}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="info">お知らせ (Info)</option>
              <option value="warning">警告 (Warning)</option>
              <option value="success">完了 (Success)</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="announcement-dismissible" className="text-sm font-medium text-gray-700">
              閉じるボタンを表示
            </label>
            <input
              type="checkbox"
              id="announcement-dismissible"
              name="announcement.dismissible"
              defaultChecked={initialData.announcement.dismissible}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>
      </fieldset>

      {/* サイト基本情報 */}
      <fieldset className="rounded-lg border border-gray-200 p-6">
        <legend className="px-2 text-lg font-semibold text-gray-900">
          サイト基本情報
        </legend>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="site-name" className="block text-sm font-medium text-gray-700">
              サイト名
            </label>
            <input
              type="text"
              id="site-name"
              name="siteName"
              defaultValue={initialData.siteName}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="site-description" className="block text-sm font-medium text-gray-700">
              サイト説明文
            </label>
            <textarea
              id="site-description"
              name="siteDescription"
              defaultValue={initialData.siteDescription}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">
              問い合わせ用メールアドレス
            </label>
            <input
              type="email"
              id="contact-email"
              name="contactEmail"
              defaultValue={initialData.contactEmail}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm
                         focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* エラー表示 */}
      {state.error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      {/* 送信ボタン */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white
                     shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "保存中..." : "設定を保存"}
        </button>
      </div>
    </form>
  );
}
```

### 6.5 変更履歴テーブル

```
┌──────────────────────────────────────────────────────────────┐
│  変更履歴                          カテゴリ: [全て ▼]         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  日時              │ カテゴリ   │ 変更内容       │ 変更者  │操作│
│  ─────────────────│──────────│──────────────│───────│────│
│  2026-02-15 14:30 │ 配送設定  │ 送料無料閾値変更 │ admin  │[戻す]│
│  2026-02-14 10:15 │ サイト設定│ バナーメッセージ更新│ admin │[戻す]│
│  2026-02-13 09:00 │ 税率設定  │ 端数処理を変更   │ admin  │[戻す]│
│  ...                                                         │
│                                                              │
│  [◀ 前へ] ページ 1 / 3 [次へ ▶]                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.6 UI仕様まとめ

| 要素 | 仕様 |
|------|------|
| タブ切り替え | クライアントサイドの state 管理 |
| フォーム送信 | Server Actions + `useActionState` |
| トグル | `<input type="checkbox">` + Tailwind スタイリング |
| セレクト | `<select>` + ネイティブ UI |
| バリデーションエラー | フィールド直下に赤文字で表示 |
| 保存成功 | トースト通知（画面右上に3秒表示） |
| ローディング | `isPending` でボタン無効化 + テキスト変更 |
| レスポンシブ | `max-w-5xl` で最大幅制限、モバイルは1カラム |

---

## 7. 設定キャッシュ戦略

### 7.1 概要

設定値は全ページで頻繁に参照されるため、Redis をキャッシュレイヤーとして利用し DB アクセスを最小化する。

### 7.2 キャッシュ実装

```typescript
// src/lib/cache/settings.ts

import { Redis } from "ioredis";
import type { SettingsCategory } from "@/types/ec-settings";

const redis = new Redis(process.env.REDIS_URL!);

const CACHE_PREFIX = "ec_settings";
const DEFAULT_TTL = 60 * 60; // 1時間（秒）

export const settingsCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}:${key}`);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch {
      // Redis 障害時は null を返してフォールバック
      return null;
    }
  },

  async set<T>(key: string, value: T, ttl = DEFAULT_TTL): Promise<void> {
    try {
      await redis.setex(
        `${CACHE_PREFIX}:${key}`,
        ttl,
        JSON.stringify(value),
      );
    } catch {
      // Redis 障害時はスキップ（DB から直接取得で代替）
    }
  },

  async invalidate(key: string): Promise<void> {
    await redis.del(`${CACHE_PREFIX}:${key}`);
  },

  async invalidateAll(): Promise<void> {
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  async invalidateCategory(category: SettingsCategory): Promise<void> {
    await redis.del(`${CACHE_PREFIX}:settings:${category}`);
    await redis.del(`${CACHE_PREFIX}:active_settings`);
  },
};
```

### 7.3 キャッシュフロー

```
読み取り:
  Client → Server Action → Redis (HIT) → レスポンス返却
  Client → Server Action → Redis (MISS) → PostgreSQL → Redis 保存 → レスポンス返却

書き込み:
  Client → Server Action → PostgreSQL 更新 → Redis 無効化 → revalidatePath
```

### 7.4 キャッシュキー一覧

| キー | 内容 | TTL |
|------|------|-----|
| `ec_settings:active_settings` | 全設定のスナップショット | 1時間 |
| `ec_settings:settings:shipping` | 配送設定 | 1時間 |
| `ec_settings:settings:tax` | 税率設定 | 1時間 |
| `ec_settings:settings:payment` | 決済設定 | 1時間 |
| `ec_settings:settings:notification` | 通知設定 | 1時間 |
| `ec_settings:settings:royalty` | ロイヤリティ設定 | 1時間 |
| `ec_settings:settings:site` | サイト設定 | 5分 |

> サイト設定の TTL が短いのは、メンテナンスモードの判定がミドルウェアで頻繁に行われるため。

### 7.5 注意事項

- 設定更新時は必ず関連キャッシュを無効化する
- Redis 障害時はフォールバックとして DB から直接取得する
- `revalidatePath` も併用し、Next.js のページキャッシュも更新する

---

## 8. 権限・アクセス制御

### 8.1 方針

EC設定の閲覧・変更は **ADMIN ロールを持つユーザーのみ** に制限する。

### 8.2 認証・認可ガード

```typescript
// src/lib/auth.ts

import { auth } from "@/auth";
import { redirect } from "next/navigation";

type UserRole = "CUSTOMER" | "CREATOR" | "ADMIN";

type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

/**
 * 認証済みユーザーを取得。未認証の場合はログインページにリダイレクト。
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user as AuthenticatedUser;
}

/**
 * ADMIN ロールを要求。権限不足の場合は403ページにリダイレクト。
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    redirect("/403");
  }
  return user;
}
```

### 8.3 ミドルウェアによるルート保護

```typescript
// src/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/settings は ADMIN のみ
  if (pathname.startsWith("/admin/settings")) {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", request.url));
    }
  }

  // メンテナンスモードチェック（管理画面・API以外）
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    // settingsCache からメンテナンスモード状態を確認
    // 有効な場合、allowedIPs に含まれないIPはメンテナンスページにリダイレクト
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

### 8.4 アクセス制御マトリクス

| 操作 | CUSTOMER | CREATOR | ADMIN |
|------|----------|---------|-------|
| 設定閲覧 | --- | --- | 可 |
| 配送設定変更 | --- | --- | 可 |
| 税率設定変更 | --- | --- | 可 |
| 決済設定変更 | --- | --- | 可 |
| 通知設定変更 | --- | --- | 可 |
| ロイヤリティ設定変更 | --- | --- | 可 |
| サイト設定変更 | --- | --- | 可 |
| 変更履歴閲覧 | --- | --- | 可 |
| 設定巻き戻し | --- | --- | 可 |

### 8.5 セキュリティ上の注意

- Stripe Secret Key (`sk_`) は環境変数で管理し、DB・ログには保存しない
- 変更履歴には変更者の ID を必ず記録する
- メンテナンスモード操作時はログを残し、意図しないロックアウトを防止する

---

## 9. デフォルト値・初期設定

### 9.1 シード処理

初回デプロイ時または DB 初期化時に、デフォルト値で設定レコードを1件作成する。

```typescript
// packages/db/src/seed/ec-settings.ts

import { db } from "@/db";
import { ecSettings } from "@/db/schema/ec-settings";
import type {
  ShippingSettings,
  TaxSettings,
  PaymentSettings,
  NotificationSettings,
  RoyaltySettings,
  SiteSettings,
} from "@/types/ec-settings";

const defaultShipping: ShippingSettings = {
  methods: [
    {
      id: "standard",
      name: "通常配送",
      carrier: "yamato",
      baseCost: 600,
      estimatedDays: { min: 3, max: 5 },
      isEnabled: true,
      regions: [
        { region: "hokkaido", additionalCost: 400 },
        { region: "tohoku", additionalCost: 0 },
        { region: "kanto", additionalCost: 0 },
        { region: "chubu", additionalCost: 0 },
        { region: "kinki", additionalCost: 0 },
        { region: "chugoku", additionalCost: 0 },
        { region: "shikoku", additionalCost: 0 },
        { region: "kyushu", additionalCost: 200 },
        { region: "okinawa", additionalCost: 800 },
      ],
    },
    {
      id: "express",
      name: "速達便",
      carrier: "yamato",
      baseCost: 1200,
      estimatedDays: { min: 1, max: 2 },
      isEnabled: true,
      regions: [
        { region: "hokkaido", additionalCost: 600 },
        { region: "tohoku", additionalCost: 0 },
        { region: "kanto", additionalCost: 0 },
        { region: "chubu", additionalCost: 0 },
        { region: "kinki", additionalCost: 0 },
        { region: "chugoku", additionalCost: 0 },
        { region: "shikoku", additionalCost: 0 },
        { region: "kyushu", additionalCost: 400 },
        { region: "okinawa", additionalCost: 1000 },
      ],
    },
  ],
  freeShippingThreshold: 10000,
  defaultMethodId: "standard",
};

const defaultTax: TaxSettings = {
  standardRate: 0.10,
  reducedRate: 0.08,
  priceDisplayMode: "tax_inclusive",
  roundingMode: "floor",
  invoiceRegistrationNumber: "T0000000000000",
  taxCalculationBase: "per_item",
};

const defaultPayment: PaymentSettings = {
  stripe: {
    isEnabled: true,
    publicKey: "pk_test_placeholder",
    webhookEndpoint: "/api/webhooks/stripe",
    statementDescriptor: "KYARAINNOVATE",
  },
  paymentMethods: [
    {
      type: "card",
      displayName: "クレジットカード",
      isEnabled: true,
      minAmount: null,
      maxAmount: null,
      sortOrder: 1,
    },
    {
      type: "paypay",
      displayName: "PayPay",
      isEnabled: true,
      minAmount: null,
      maxAmount: 500000,
      sortOrder: 2,
    },
    {
      type: "customer_balance",
      displayName: "銀行振込",
      isEnabled: false,
      minAmount: 1000,
      maxAmount: null,
      sortOrder: 3,
    },
    {
      type: "konbini",
      displayName: "コンビニ決済",
      isEnabled: true,
      minAmount: null,
      maxAmount: 300000,
      sortOrder: 4,
    },
  ],
  currency: "jpy",
};

const defaultNotification: NotificationSettings = {
  emailFrom: "noreply@kyarainnovate.com",
  emailFromName: "KyaraInnovate",
  replyTo: "support@kyarainnovate.com",
  templates: [
    {
      trigger: "order_confirmed",
      subject: "【KyaraInnovate】ご注文ありがとうございます（注文番号: {{orderNumber}}）",
      bodyHtml: "<p>{{customerName}} 様</p><p>ご注文を承りました。</p>",
      bodyText: "{{customerName}} 様\nご注文を承りました。",
      isEnabled: true,
      variables: ["customerName", "orderNumber", "orderTotal", "orderDate", "fragranceName", "shopName"],
    },
    {
      trigger: "order_shipped",
      subject: "【KyaraInnovate】商品を発送しました（注文番号: {{orderNumber}}）",
      bodyHtml: "<p>{{customerName}} 様</p><p>商品を発送いたしました。</p><p>追跡番号: {{trackingNumber}}</p>",
      bodyText: "{{customerName}} 様\n商品を発送いたしました。\n追跡番号: {{trackingNumber}}",
      isEnabled: true,
      variables: ["customerName", "orderNumber", "trackingNumber", "carrierName", "trackingUrl", "shopName"],
    },
    {
      trigger: "order_delivered",
      subject: "【KyaraInnovate】商品が配達されました（注文番号: {{orderNumber}}）",
      bodyHtml: "<p>{{customerName}} 様</p><p>商品が配達されました。</p>",
      bodyText: "{{customerName}} 様\n商品が配達されました。",
      isEnabled: true,
      variables: ["customerName", "orderNumber", "fragranceName", "shopName"],
    },
    {
      trigger: "review_request",
      subject: "【KyaraInnovate】ご感想をお聞かせください",
      bodyHtml: "<p>{{customerName}} 様</p><p>商品はいかがでしたか？</p><p><a href='{{reviewUrl}}'>レビューを書く</a></p>",
      bodyText: "{{customerName}} 様\n商品はいかがでしたか？\nレビューURL: {{reviewUrl}}",
      isEnabled: true,
      variables: ["customerName", "orderNumber", "fragranceName", "reviewUrl", "shopName"],
    },
    {
      trigger: "order_cancelled",
      subject: "【KyaraInnovate】ご注文がキャンセルされました（注文番号: {{orderNumber}}）",
      bodyHtml: "<p>{{customerName}} 様</p><p>ご注文がキャンセルされました。</p>",
      bodyText: "{{customerName}} 様\nご注文がキャンセルされました。",
      isEnabled: true,
      variables: ["customerName", "orderNumber", "orderTotal", "shopName"],
    },
    {
      trigger: "admin_new_order",
      subject: "【管理者通知】新規注文（注文番号: {{orderNumber}}）",
      bodyHtml: "<p>新規注文が入りました。</p><p>注文番号: {{orderNumber}}</p>",
      bodyText: "新規注文が入りました。\n注文番号: {{orderNumber}}",
      isEnabled: true,
      variables: ["orderNumber", "orderTotal", "customerName"],
    },
    {
      trigger: "password_reset",
      subject: "【KyaraInnovate】パスワードリセットのご案内",
      bodyHtml: "<p>{{customerName}} 様</p><p><a href='{{resetUrl}}'>パスワードをリセット</a></p>",
      bodyText: "{{customerName}} 様\nURL: {{resetUrl}}",
      isEnabled: true,
      variables: ["customerName", "resetUrl", "shopName"],
    },
    {
      trigger: "account_registered",
      subject: "【KyaraInnovate】アカウント登録が完了しました",
      bodyHtml: "<p>{{customerName}} 様</p><p>ご登録ありがとうございます。</p>",
      bodyText: "{{customerName}} 様\nご登録ありがとうございます。",
      isEnabled: true,
      variables: ["customerName", "shopName"],
    },
  ],
  reviewRequestDelayDays: 7,
};

const defaultRoyalty: RoyaltySettings = {
  tiers: [
    { tier: "APPRENTICE", displayName: "アプレンティス", royaltyRate: 0.10 },
    { tier: "ARTISAN", displayName: "アルチザン", royaltyRate: 0.12 },
    { tier: "EXPERT", displayName: "エキスパート", royaltyRate: 0.15 },
    { tier: "MASTER", displayName: "マスター", royaltyRate: 0.18 },
    { tier: "GRAND_MASTER", displayName: "グランドマスター", royaltyRate: 0.20 },
  ],
  payoutSchedule: "monthly",
  payoutMinimumAmount: 5000,
  payoutDay: 25,
  calculationBase: "net_sales",
  isEnabled: true,
};

const defaultSite: SiteSettings = {
  maintenanceMode: {
    isEnabled: false,
    message: "ただいまメンテナンス中です。ご不便をおかけして申し訳ございません。",
    allowedIPs: [],
    scheduledEnd: null,
  },
  announcement: {
    isEnabled: false,
    message: "",
    type: "info",
    linkUrl: null,
    linkText: null,
    dismissible: true,
  },
  siteName: "KyaraInnovate",
  siteDescription: "あなただけのオリジナルフレグランスを作れるオーダーメイド香水ECサイト",
  contactEmail: "support@kyarainnovate.com",
};

export async function seedEcSettings() {
  const existing = await db.select().from(ecSettings).limit(1);

  if (existing.length > 0) {
    console.log("[seed] ec_settings: レコードが既に存在するためスキップ");
    return;
  }

  await db.insert(ecSettings).values({
    shipping: defaultShipping,
    tax: defaultTax,
    payment: defaultPayment,
    notification: defaultNotification,
    royalty: defaultRoyalty,
    site: defaultSite,
    version: 1,
    isActive: true,
  });

  console.log("[seed] ec_settings: デフォルト設定を作成しました");
}
```

### 9.2 デフォルト値サマリー

| カテゴリ | 主要デフォルト値 |
|---------|----------------|
| 配送 | 通常配送 600円 / 速達便 1,200円 / 送料無料ライン 10,000円 |
| 税率 | 標準10% / 軽減8% / 税込表示 / 切り捨て |
| 決済 | クレジットカード・PayPay・コンビニ ON / 銀行振込 OFF |
| 通知 | 全トリガー ON / レビューリクエスト 7日後 / Resend |
| ロイヤリティ | 4ティア (5%/8%/12%/15%) / 月末25日払い / 最低 5,000円 |
| サイト | メンテナンスモード OFF / バナー非表示 |

---

## 10. 環境変数一覧

EC設定機能に関連する環境変数:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL接続URL | `postgresql://postgres:postgres@db:5432/kyarainnovate` |
| `REDIS_URL` | Redis接続URL（設定キャッシュ用） | `redis://localhost:6379` |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe パブリックキー | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名キー | `whsec_...` |
| `RESEND_API_KEY` | Resend APIキー（メール送信） | `re_...` |
| `EMAIL_FROM` | 送信元アドレス | `noreply@kyarainnovate.com` |
| `AUTH_SECRET` | Auth.js署名キー | `openssl rand -base64 32` |

> Stripe Secret Key は DB に保存しない。管理画面に表示する場合もマスク処理（`sk_****...****`）を行う。

---

## 11. 画面一覧

| パス | 画面名 | 説明 |
|------|--------|------|
| `/admin/settings` | EC設定（配送） | 配送方法・送料・送料無料ライン |
| `/admin/settings` (税率タブ) | 税率設定 | 消費税率・表示方式・端数処理 |
| `/admin/settings` (決済タブ) | 決済設定 | Stripe接続・決済方法ON/OFF |
| `/admin/settings` (通知タブ) | 通知設定 | メールテンプレート・トリガーON/OFF |
| `/admin/settings` (ロイヤリティタブ) | ロイヤリティ設定 | ティア料率・振込スケジュール |
| `/admin/settings` (サイトタブ) | サイト設定 | メンテナンスモード・バナー |
| `/admin/settings` (履歴タブ) | 変更履歴 | 設定変更ログ・巻き戻し |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | B-04修正: ロイヤリティティアを bronze/silver/gold/platinum（4段階）から APPRENTICE〜GRAND_MASTER（5段階）に統一。creator-system.md §7 のクリエイターティアと連動。料率を 10%/12%/15%/18%/20% に変更。型定義・バリデーション・デフォルト値・管理画面ワイヤフレームを更新 |
| 2026-02-15 | v2.0 - 全面改訂: JSONB カラム方式・キャッシュ戦略・Zod バリデーション・Server Actions・変更履歴機能を追加 |
| 2026-02-15 | v1.0 - 初版作成 |

---

*最終更新: 2026年2月17日*
