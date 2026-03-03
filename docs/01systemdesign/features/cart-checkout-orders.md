# カート・決済・注文管理 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 対象機能 | カート・チェックアウト・注文管理 |
| バージョン | 1.2 |
| 作成日 | 2026-02-15 |
| 最終更新日 | 2026-02-17 |

---

## 1. カート機能

### 1.1 カートアイテム操作

**Server Action 一覧:**

| Action | 説明 | 権限 |
|--------|------|------|
| `addToCart` | カートにアイテム追加 | CUSTOMER |
| `updateCartItem` | 数量変更 | CUSTOMER |
| `removeCartItem` | アイテム削除 | CUSTOMER |
| `clearCart` | カート全削除 | CUSTOMER |
| `applyCoupon` | クーポン適用 | CUSTOMER |
| `removeCoupon` | クーポン解除 | CUSTOMER |

**`addToCart` Zodスキーマ:**

```typescript
const addToCartSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  giftWrapping: z.boolean().default(false),
});
```

**処理:**
1. セッションからユーザーID取得
2. アクティブなカートを検索（なければ作成）
3. 同一バリアントが既にあれば数量加算
4. 在庫チェック（`stock >= 要求数量`）
5. `cart_items` にINSERT/UPDATE
6. カート合計を再計算
7. `revalidatePath` で再検証

### 1.2 カート表示

```
┌─────────────────────────────────────────────────────────┐
│  ショッピングカート (3点)                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  送料無料まであと ¥2,200                                 │
│  ████████████████████░░░░░░  ¥5,800 / ¥8,000           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐  商品名A (30ml)              ¥6,600           │
│  │ IMG │  by クリエーター名                              │
│  └─────┘  □ ギフトラッピング (+¥500)                    │
│           数量: [- 1 +]         [削除]                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐  商品名B (50ml)              ¥8,800           │
│  │ IMG │  by クリエーター名                              │
│  └─────┘  ☑ ギフトラッピング (+¥500)                    │
│           数量: [- 2 +]         [削除]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  クーポンコード: [____________] [適用]                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  注文概要                                               │
│  ─────────────────────────────────                      │
│  小計 (3点)                              ¥24,200        │
│  割引 (クーポン: WELCOME10)              -¥2,420        │
│  ギフトラッピング (1点)                    ¥500          │
│  送料                                      ¥600         │
│  ─────────────────────────────────                      │
│  合計                                    ¥22,880        │
│  (うち消費税 ¥2,080)                                    │
│                                                         │
│  [VISA] [Mastercard] [JCB] [PayPay] [コンビニ]          │
│                                                         │
│  [お支払いへ進む]                                        │
└─────────────────────────────────────────────────────────┘
```

### 1.3 送料無料プログレスバー

| 条件 | 表示 |
|------|------|
| 小計 < ¥8,000 | 「送料無料まであと ¥{残額}」+ プログレスバー |
| 小計 >= ¥8,000 | 「送料無料です!」+ 完了バー（緑） |

### 1.4 注文概要計算ロジック

```typescript
type OrderSummary = {
  subtotal: number;         // 小計（商品合計）
  discount: number;         // 割引額（クーポン）
  giftWrappingFee: number;  // ギフトラッピング合計
  shippingFee: number;      // 送料
  total: number;            // 合計
  tax: number;              // 消費税（内税）
};

// 計算式
// subtotal = Σ(variant.price * item.quantity)
// discount = クーポン適用額
// giftWrappingFee = ギフトラッピング数 * 500
// shippingFee = subtotal >= 8000 ? 0 : 配送方法別料金
// total = subtotal - discount + giftWrappingFee + shippingFee
// tax = Math.floor(total * 10 / 110)  // 内税10%
```

**金額計算は `Decimal.js` を使用して精度を保証する。**

---

## 2. 決済フロー

### 2.1 チェックアウトステップ

```
[1. カート] ──→ [2. お支払い] ──→ [3. 確認・完了]
    ●              ○                  ○
```

| ステップ | パス | 内容 |
|---------|------|------|
| 1. カート | `/cart` | カート内容確認、クーポン適用 |
| 2. お支払い | `/checkout` | 配送先・配送方法・支払方法選択 |
| 3. 確認 | `/checkout/confirm` | 最終確認 → 注文確定 |
| 完了 | `/checkout/complete/[orderId]` | 注文完了画面 |

### 2.2 配送先選択

```
┌─────────────────────────────────────────────┐
│  配送先                                      │
│                                              │
│  ● 自宅（デフォルト）                         │
│    吉岡 太郎                                  │
│    〒100-0001 東京都千代田区千代田1-1-1        │
│    TEL: 090-XXXX-XXXX                        │
│                                              │
│  ○ 勤務先                                    │
│    〒150-0001 東京都渋谷区...                  │
│                                              │
│  ○ [+ 新しい配送先を追加]                     │
└─────────────────────────────────────────────┘
```

- 登録済み配送先一覧から選択
- デフォルト配送先を初期選択
- 新規配送先をインラインで追加可能
- 配送先の詳細は [shipping-address.md](./shipping-address.md) を参照

### 2.3 配送方法

| 配送方法 | 料金 | 所要日数 | 説明 |
|---------|------|---------|------|
| 通常配送 | ¥600 | 3〜5営業日 | ヤマト運輸 |
| お急ぎ便 | ¥1,200 | 1〜2営業日 | ヤマト運輸（速達） |
| 日時指定便 | ¥800 | 指定日 | 日付・時間帯選択可 |

**注:** ¥8,000以上で通常配送のみ送料無料。お急ぎ・日時指定は差額が発生。

**日時指定の時間帯:**
- 午前中 (8:00〜12:00)
- 14:00〜16:00
- 16:00〜18:00
- 18:00〜20:00
- 19:00〜21:00

### 2.4 支払方法

| 支払方法 | 実装 | 手数料 | 即時決済 |
|---------|------|--------|---------|
| クレジットカード | Stripe Payment Intents | なし | ○ |
| 銀行振込 | 手動確認 | なし | × |
| PayPay | Stripe + PayPay連携 | なし | ○ |
| コンビニ決済 | Stripe Konbini | なし | × |

### 2.5 クレジットカードフォーム (Stripe Elements)

```
┌─────────────────────────────────────────────┐
│  お支払い方法                                 │
│                                              │
│  ● クレジットカード                           │
│                                              │
│  カード番号                                   │
│  [4242 4242 4242 4242          ]  [VISA]     │
│                                              │
│  有効期限           セキュリティコード          │
│  [12 / 28]          [123]                    │
│                                              │
│  カード名義                                   │
│  [TARO YOSHIOKA                 ]            │
│                                              │
│  □ このカードを保存する                       │
│                                              │
│  ○ 銀行振込                                  │
│  ○ PayPay                                    │
│  ○ コンビニ決済                               │
└─────────────────────────────────────────────┘
```

**Stripe実装:**

```typescript
// Server Action: createPaymentIntent
const createPaymentIntentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.enum(['card', 'bank_transfer', 'paypay', 'konbini']),
  saveCard: z.boolean().default(false),
});
```

**処理:**
1. 注文金額を計算
2. Stripe `paymentIntents.create()` を呼び出し
3. `client_secret` をクライアントに返却
4. クライアント側で `stripe.confirmPayment()` を実行
5. Webhook (`payment_intent.succeeded`) で決済完了を処理

### 2.6 ギフトメッセージ

```typescript
const giftMessageSchema = z.object({
  message: z.string().max(200).optional(),
});
```

| 項目 | 仕様 |
|------|------|
| 最大文字数 | 200文字 |
| 表示条件 | カートにギフトラッピングが1点以上 |
| 入力 | textarea |

### 2.7 備考欄

```typescript
const orderNoteSchema = z.object({
  note: z.string().max(500).optional(),
});
```

### 2.8 注文確定処理

**Server Action: `placeOrder`**

```typescript
const placeOrderSchema = z.object({
  cartId: z.string().uuid(),
  addressId: z.string().uuid(),
  shippingMethod: z.enum(['standard', 'express', 'scheduled']),
  scheduledDate: z.string().datetime().optional(),
  scheduledTimeSlot: z.string().optional(),
  paymentMethod: z.enum(['card', 'bank_transfer', 'paypay', 'konbini']),
  giftMessage: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  couponCode: z.string().optional(),
});
```

**処理フロー:**
1. カート内容と在庫の最終チェック
2. 注文レコード作成（ステータス: `PENDING`）
3. 注文明細（`order_items`）作成
4. 在庫を減算
5. Stripe Checkout Session 作成
6. Stripe Checkout ページにリダイレクト
7. 決済完了 → Webhook `checkout.session.completed` で `PENDING` → `CONFIRMED` に遷移
8. `payments` レコード作成（status: `succeeded`）
9. カートをクリア（`status = 'completed'`）
10. 確認メール送信
11. `/checkout/complete/[orderId]` にリダイレクト

**決済失敗・タイムアウト時:**
- Stripe Checkout Session は30分で自動期限切れ
- Webhook `checkout.session.expired` で `PENDING` → `CANCELLED` に遷移
- 在庫を戻す
- カートはそのまま維持（再チェックアウト可能）

> **注:** `payment_failed` ステータスは廃止。決済未完了は `PENDING` のまま保持し、30分のタイムアウトで `CANCELLED` に遷移する（§8.9参照）。

---

## 3. 注文ライフサイクル

### 3.1 ステータス定義

| ステータス | 表示名 | 説明 |
|-----------|--------|------|
| `PENDING` | 決済待ち | Stripe Checkout Session作成済み、決済未完了 |
| `CONFIRMED` | 注文確定 | 決済完了、クリエーター未着手 |
| `PREPARING` | 調香準備中 | クリエーターが注文を確認、素材を準備（キャンセル可） |
| `MANUFACTURING` | 調香中 | 香料の混合を開始（以降キャンセル不可） |
| `MANUFACTURED` | 調香完了 | 品質チェック完了、発送準備 |
| `SHIPPED` | 発送済み | 配送業者に引き渡し済み |
| `DELIVERED` | 配達完了 | 配送完了 |
| `CANCELLED` | キャンセル | 注文キャンセル |
| `RETURNED` | 返品 | 返品処理完了 |

> **注:** 全ステータスはUPPERCASEで統一。`payment_failed` は廃止 — `PENDING` のまま30分タイムアウトで `CANCELLED` に遷移するフローで代替（§8.9参照）。

### 3.2 ステータス遷移ルール

```
PENDING → CONFIRMED → PREPARING → MANUFACTURING → MANUFACTURED → SHIPPED → DELIVERED
  │          │            │                                                     │
  ▼          ▼            ▼                                                     ▼
CANCELLED  CANCELLED   CANCELLED                                             RETURNED
```

| 遷移元 | 遷移先 | トリガー | 変更権限 | 条件 |
|--------|--------|---------|---------|------|
| `PENDING` | `CONFIRMED` | Stripe Webhook `checkout.session.completed` | システム | 決済完了 |
| `PENDING` | `CANCELLED` | Stripe Webhook `checkout.session.expired` / ユーザー操作 | システム/ユーザー | 30分タイムアウト or キャンセル |
| `CONFIRMED` | `PREPARING` | クリエーター確認 | ADMIN, CREATOR | - |
| `CONFIRMED` | `CANCELLED` | 管理者/ユーザー操作 | ADMIN, CUSTOMER | - |
| `PREPARING` | `MANUFACTURING` | 調香開始 | ADMIN, CREATOR | - |
| `PREPARING` | `CANCELLED` | ユーザー/管理者操作 | ADMIN, CUSTOMER | 調香開始前のみ |
| `MANUFACTURING` | `MANUFACTURED` | 調香完了 | ADMIN, CREATOR | - |
| `MANUFACTURED` | `SHIPPED` | 追跡番号登録 | ADMIN | 追跡番号登録済み |
| `SHIPPED` | `DELIVERED` | 配送完了 | ADMIN, システム | - |
| `DELIVERED` | `RETURNED` | 返品受付 | ADMIN | 配送完了後7日以内 |

### 3.3 Stripe Checkout連携とステータス遷移

§3.1-3.2の統一ステートマシンにおけるStripe Checkout Session / Webhookとの接続方法を定義する。

**Stripe Checkout フロー:**

```
[placeOrder] ──→ Checkout Session作成 ──→ Stripeホスト決済ページ
                  (status: PENDING)            │
                                               ├── 決済成功 → Webhook: checkout.session.completed
                                               │                → PENDING → CONFIRMED
                                               │
                                               └── 期限切れ/キャンセル → Webhook: checkout.session.expired
                                                                         → PENDING → CANCELLED
```

**Stripe Webhook ハンドリング:**

| Webhook イベント | 処理 | ステータス遷移 |
|-----------------|------|---------------|
| `checkout.session.completed` | 決済確認、`payments.status` を `succeeded` に更新 | `PENDING` → `CONFIRMED` |
| `checkout.session.expired` | 在庫を戻す、カート復元可能 | `PENDING` → `CANCELLED` |
| `charge.refunded` | 返金処理記録 | ステータス変更なし（§6.4参照） |

> **注:** §3.2の完全な遷移テーブルが正（Single Source of Truth）。本セクションはStripe固有のトリガーのみを記述する。`CONFIRMED` 以降の遷移（`PREPARING` → `MANUFACTURING` → ...）はStripeとは無関係に管理画面/クリエーター操作で行う。

### 3.4 追跡情報

```typescript
type ShippingInfo = {
  carrier: 'yamato' | 'sagawa' | 'japan_post';
  trackingNumber: string;
  shippedAt: Date;
  estimatedDeliveryAt: Date | null;
};
```

| 配送業者 | 表示名 | 追跡URL |
|---------|--------|---------|
| `yamato` | ヤマト運輸 | `https://jizen.kuronekoyamato.co.jp/jizen/servlet/crjz.b.NQ0010?id={number}` |
| `sagawa` | 佐川急便 | `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo={number}` |
| `japan_post` | 日本郵便 | `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1={number}` |

### 3.5 メール通知

| トリガー | メール種別 | 送信先 | 内容 |
|---------|-----------|--------|------|
| 注文確定 | 注文確認メール | 顧客 | 注文番号、商品一覧、合計、配送先 |
| 発送時 | 発送通知メール | 顧客 | 追跡番号、追跡URL、届け予定日 |
| 配送完了 | 配送完了メール | 顧客 | 配送完了通知 |
| 配送完了+3日 | レビュー依頼メール | 顧客 | レビュー投稿への導線 |
| キャンセル確定 | キャンセル確認メール | 顧客 | 注文番号、返金額、返金時期 |
| キャンセル確定 | キャンセル通知 | クリエーター | 注文番号、キャンセル理由 |

---

## 4. 注文一覧（顧客向け）

### 4.1 画面レイアウト

```
┌─────────────────────────────────────────────────────────┐
│  注文履歴                                                │
│                                                         │
│  検索: [注文番号・商品名で検索     ]                      │
│                                                         │
│  ステータス: [すべて ▼]   期間: [過去6ヶ月 ▼]             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  注文 #KI-20260215-001          2026/02/15               │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 確定 → 製造中 → 製造完了 → 発送 → 配送完了      │    │
│  │  ●       ●        ●        ◎       ○           │    │
│  └─────────────────────────────────────────────────┘    │
│  商品名A (30ml) x1  ¥6,600                              │
│  商品名B (50ml) x2  ¥17,600                             │
│  合計: ¥22,880                                          │
│  [配送状況を確認]  [再注文]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  注文 #KI-20260210-003          2026/02/10               │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 確定 → 製造中 → 製造完了 → 発送 → 配送完了      │    │
│  │  ●       ●        ●        ●       ●           │    │
│  └─────────────────────────────────────────────────┘    │
│  商品名C (10ml) x1  ¥3,300                              │
│  合計: ¥3,900                                           │
│  [レビューを書く]  [再注文]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 フィルター

| フィルター | 選択肢 |
|-----------|--------|
| ステータス | すべて / 決済待ち(`PENDING`) / 注文確定(`CONFIRMED`) / 調香準備中(`PREPARING`) / 調香中(`MANUFACTURING`) / 調香完了(`MANUFACTURED`) / 発送済み(`SHIPPED`) / 配達完了(`DELIVERED`) / キャンセル(`CANCELLED`) / 返品(`RETURNED`) |
| 期間 | 過去1ヶ月 / 過去3ヶ月 / 過去6ヶ月 / 過去1年 / すべて |

### 4.3 注文カードアクション

| ステータス | 表示アクション |
|-----------|---------------|
| `PENDING` | キャンセル |
| `CONFIRMED` | キャンセル |
| `PREPARING` | キャンセル |
| `MANUFACTURING` / `MANUFACTURED` | - |
| `SHIPPED` | 配送状況を確認 |
| `DELIVERED` | レビューを書く / 再注文 |
| `CANCELLED` | 再注文 |
| `RETURNED` | 再注文 |

---

## 5. 注文詳細（顧客向け）

### 5.1 画面レイアウト

```
┌─────────────────────────────────────────────────────────┐
│  注文 #KI-20260215-001                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ■ 注文確定          2026/02/15 14:30                   │
│  │ ご注文を受け付けました                                │
│  │                                                      │
│  ■ 製造開始          2026/02/16 10:00                   │
│  │ クリエーターが製造を開始しました                       │
│  │                                                      │
│  ■ 製造完了          2026/02/18 15:00                   │
│  │ 製造が完了しました。発送準備に入ります                 │
│  │                                                      │
│  ◉ 発送済み          2026/02/19 09:00                   │
│  │ ヤマト運輸 追跡番号: 1234-5678-9012                  │
│  │ [追跡ページを開く]                                    │
│  │                                                      │
│  ○ 配送完了          -                                  │
│    お届け予定: 2026/02/21                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  商品情報                                                │
│                                                         │
│  ┌─────┐  商品名A (30ml) x1       ¥6,600               │
│  │ IMG │  by クリエーター名                              │
│  └─────┘  [レビューを書く]                               │
│                                                         │
│  ┌─────┐  商品名B (50ml) x2       ¥17,600              │
│  │ IMG │  by クリエーター名                              │
│  └─────┘  ☑ ギフトラッピング                            │
│           [レビューを書く]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  お支払い明細                                            │
│  ─────────────────────────                              │
│  小計                                    ¥24,200        │
│  割引 (WELCOME10)                        -¥2,420        │
│  ギフトラッピング                          ¥500          │
│  送料 (通常配送)                           ¥600          │
│  ─────────────────────────                              │
│  合計                                    ¥22,880        │
│  (うち消費税 ¥2,080)                                    │
│  支払方法: VISA **** 4242                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  配送先                                                  │
│  吉岡 太郎                                               │
│  〒100-0001 東京都千代田区千代田1-1-1                     │
│  TEL: 090-XXXX-XXXX                                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [再注文]  [領収書を発行]  [お問い合わせ]                  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 タイムライン

| ステップ | アイコン状態 | 日時 | 詳細テキスト |
|---------|-------------|------|-------------|
| 注文確定 | ● 完了 / ○ 未到達 | yyyy/MM/dd HH:mm | 「ご注文を受け付けました」 |
| 製造開始 | ● 完了 / ○ 未到達 | yyyy/MM/dd HH:mm | 「クリエーターが製造を開始しました」 |
| 製造完了 | ● 完了 / ○ 未到達 | yyyy/MM/dd HH:mm | 「製造が完了しました。発送準備に入ります」 |
| 発送済み | ● 完了 / ◉ 現在 / ○ 未到達 | yyyy/MM/dd HH:mm | 追跡番号 + 追跡リンク |
| 配送完了 | ● 完了 / ○ 未到達 | yyyy/MM/dd HH:mm | 「お届けが完了しました」 |

### 5.3 アクション

| アクション | 説明 | 条件 |
|-----------|------|------|
| 再注文 | 同じ商品をカートに追加 | いつでも |
| 領収書を発行 | PDF領収書をダウンロード | 決済完了後 |
| お問い合わせ | お問い合わせフォームへ（注文番号付き） | いつでも |

---

## 6. 注文管理（Admin）

### 6.1 注文一覧テーブル

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  注文管理                                              [一括ステータス変更 ▼]      │
│                                                                                     │
│  検索: [注文番号・顧客名          ]  ステータス: [すべて ▼]  期間: [今月 ▼]         │
├──┬──────────────┬────────┬──────┬─────────┬──────────┬──────┬──────┬──────────┤
│☐│ 注文#        │ 日時   │ 顧客 │ 商品    │クリエーター│ 金額  │ 決済  │ステータス│
├──┼──────────────┼────────┼──────┼─────────┼──────────┼──────┼──────┼──────────┤
│☐│KI-20260215-01│02/15   │吉岡  │商品A x1 │田中      │¥22,880│カード │製造中    │
│☐│KI-20260215-02│02/15   │山田  │商品B x2 │佐藤      │¥18,200│PayPay │注文確定  │
│☑│KI-20260214-01│02/14   │鈴木  │商品C x1 │田中      │¥3,900 │カード │発送済み  │
└──┴──────────────┴────────┴──────┴─────────┴──────────┴──────┴──────┴──────────┘
```

### 6.2 一括ステータス変更

- チェックボックスで複数注文を選択
- ドロップダウンから遷移先ステータスを選択
- 遷移ルールに違反する注文はスキップ（エラー表示）

### 6.3 注文詳細（管理画面）

```
┌─────────────────────────────────────────────────────────┐
│  注文 #KI-20260215-001                                   │
│                                                         │
│  ステータス変更:                                         │
│  [注文確定] [製造開始] [製造完了] [発送済み] [配送完了]    │
│      ──        ★         ──        ──        ──         │
│  (★ = 現在のステータス、次に進めるボタンのみ有効)          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  追跡番号登録                                            │
│  配送業者: [ヤマト運輸 ▼]                                │
│  追跡番号: [1234-5678-9012    ]  [登録]                  │
├─────────────────────────────────────────────────────────┤
│  内部メモ                                                │
│  [                                          ]            │
│  [                                          ]  [保存]    │
├─────────────────────────────────────────────────────────┤
│  操作ログ                                                │
│  2026/02/16 10:00  admin@example.com  製造開始に変更     │
│  2026/02/15 14:30  system             注文確定           │
│  2026/02/15 14:30  system             Stripe決済完了     │
├─────────────────────────────────────────────────────────┤
│  返金処理                                                │
│  返金理由: [________________]                            │
│  返金額:   [¥22,880         ] (全額 / 一部)              │
│  [返金を実行]                                            │
└─────────────────────────────────────────────────────────┘
```

### 6.4 返金処理

**Server Action: `processRefund`**

```typescript
const processRefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().min(1),
  reason: z.string().min(1).max(500),
  type: z.enum(['full', 'partial']),
});
```

**処理:**
1. Stripe `refunds.create()` を呼び出し
2. `payments` テーブルのステータスを `refunded` / `partially_refunded` に更新
3. 注文ステータスを `CANCELLED` / `RETURNED` に更新
4. 操作ログに記録
5. 返金確認メールを顧客に送信

### 6.5 操作ログ

```typescript
type OrderLog = {
  orderId: string;
  action: string;      // 'status_change' | 'tracking_added' | 'refund' | 'note_added'
  detail: string;
  performedBy: string; // userId or 'system'
  performedAt: Date;
};
```

---

## 7. DBスキーマ

### 7.1 carts テーブル

```typescript
export const carts = pgTable('carts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('active').notNull(),
    // active | completed | abandoned
  couponCode: varchar('coupon_code', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.2 cart_items テーブル

```typescript
export const cartItems = pgTable('cart_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  cartId: uuid('cart_id').notNull().references(() => carts.id),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  // productVariants テーブルのスキーマは ec-shop.md §6.2 を参照
  quantity: integer('quantity').notNull().default(1),
  giftWrapping: boolean('gift_wrapping').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueItem: unique().on(table.cartId, table.variantId),
}));
```

### 7.3 orders テーブル

```typescript
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 30 }).notNull().unique(),
    // フォーマット: KI-YYYYMMDD-NNN
  userId: uuid('user_id').notNull().references(() => users.id),
  addressId: uuid('address_id').notNull().references(() => addresses.id),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    // PENDING | CONFIRMED | PREPARING | MANUFACTURING | MANUFACTURED | SHIPPED | DELIVERED | CANCELLED | RETURNED
  shippingMethod: varchar('shipping_method', { length: 20 }).notNull(),
    // standard | express | scheduled
  scheduledDate: date('scheduled_date'),
  scheduledTimeSlot: varchar('scheduled_time_slot', { length: 20 }),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').default(0).notNull(),
  giftWrappingFee: integer('gift_wrapping_fee').default(0).notNull(),
  shippingFee: integer('shipping_fee').notNull(),
  total: integer('total').notNull(),
  tax: integer('tax').notNull(),
  couponCode: varchar('coupon_code', { length: 50 }),
  giftMessage: text('gift_message'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.4 order_items テーブル

```typescript
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  // productVariants テーブルのスキーマは ec-shop.md §6.2 を参照
  productName: varchar('product_name', { length: 100 }).notNull(), // スナップショット
  volume: integer('volume').notNull(), // スナップショット
  price: integer('price').notNull(), // 購入時価格（スナップショット）
  quantity: integer('quantity').notNull(),
  giftWrapping: boolean('gift_wrapping').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7.5 order_status_history テーブル

```typescript
export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  status: varchar('status', { length: 20 }).notNull(),
  detail: text('detail'),
  performedBy: uuid('performed_by').references(() => users.id),
    // null の場合は system
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7.6 payments テーブル

```typescript
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  stripePaymentId: varchar('stripe_payment_id', { length: 100 }),
  method: varchar('method', { length: 20 }).notNull(),
    // card | bank_transfer | paypay | konbini
  status: varchar('status', { length: 20 }).notNull().default('pending'),
    // pending | succeeded | failed | refunded | partially_refunded
  amount: integer('amount').notNull(),
  refundedAmount: integer('refunded_amount').default(0),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.7 shipping_info テーブル

```typescript
export const shippingInfo = pgTable('shipping_info', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  carrier: varchar('carrier', { length: 20 }).notNull(),
    // yamato | sagawa | japan_post
  trackingNumber: varchar('tracking_number', { length: 50 }).notNull(),
  shippedAt: timestamp('shipped_at').defaultNow().notNull(),
  estimatedDeliveryAt: timestamp('estimated_delivery_at'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 7.8 インデックス

```typescript
// carts
export const cartsIdx = {
  userIdx: index('carts_user_idx').on(carts.userId),
  statusIdx: index('carts_status_idx').on(carts.status),
};

// orders
export const ordersIdx = {
  userIdx: index('orders_user_idx').on(orders.userId),
  statusIdx: index('orders_status_idx').on(orders.status),
  orderNumberIdx: index('orders_number_idx').on(orders.orderNumber),
  createdAtIdx: index('orders_created_at_idx').on(orders.createdAt),
};

// payments
export const paymentsIdx = {
  orderIdx: index('payments_order_idx').on(payments.orderId),
  stripeIdx: index('payments_stripe_idx').on(payments.stripePaymentId),
};

// shipping_info
export const shippingIdx = {
  orderIdx: index('shipping_order_idx').on(shippingInfo.orderId),
  trackingIdx: index('shipping_tracking_idx').on(shippingInfo.trackingNumber),
};
```

### 7.9 ER図

```
                       ┌──────────────┐
                       │product_      │
                       │variants      │
                       │(ec-shop.md)  │
                       │              │
                       │volume, price │
                       │stock, sku    │
                       └──────┬───────┘
                              │ 1
                              │
               ┌──────────────┼──────────────┐
               │ N            │ N            │
┌──────────┐   │              │              │
│  users   │   │              │              │
└────┬─────┘   │              │              │
     │ 1       │              │              │
     │         │              │              │
     │ N       │   N          │  1           │
┌────▼─────┐   │  ┌──────────▼───────────┐  │
│  carts   │   │  │       orders         │  │
│          │   │  │                      │  │
│ userId   │   │  │ userId, addressId,   │  │
│ status   │   │  │ status, total, ...   │  │
│ coupon   │   │  │                      │  │
└────┬─────┘   │  └──┬──────┬──────┬─────┘  │
     │ 1       │     │ 1    │ 1    │ 1      │
     │         │     │      │      │        │
     │ N       │     │ N    │ N    │ 1      │
┌────▼─────┐   │ ┌───▼───┐ ┌▼────┐ ┌▼──────────┐
│cart_items ├───┘ │order  │ │order│ │shipping   │
│          │     │_items ├─┘_stat│ │_info      │
│variantId─┼─FK  │       │ │us_  │ │           │
│quantity  │     │price  │ │hist │ │carrier    │
│gift      │     │qty    │ │ory  │ │tracking#  │
└──────────┘     │varian │ └─────┘ └───────────┘
                 │tId─FK │
                 └───┬───┘
                     │ 1
                     │
                     │ 1
                 ┌───▼────┐
                 │payments│
                 │        │
                 │stripe  │
                 │method  │
                 │status  │
                 └────────┘

FK: cart_items.variantId ──→ product_variants.id
FK: order_items.variantId ──→ product_variants.id
※ product_variants のスキーマ定義は ec-shop.md §6.2 を参照
```

---

## 8. キャンセルポリシー

### 8.1 キャンセル可否ルール

受注生産（オーダーメイド香水）のため、調香開始後のキャンセルは不可。
香料は一度混合すると物理的に分離不可能であり、クリエーターの作業時間も不可逆。

| ステータス | キャンセル | 返金率 | 理由 |
|-----------|:---------:|:------:|------|
| `PENDING`（決済待ち） | **可** | 100% | 決済未完了、即時キャンセル |
| `CONFIRMED`（注文確定） | **可** | 100% | まだ着手していない |
| `PREPARING`（調香準備中） | **可** | 100% | 香料の計量前なら原状復帰可能 |
| `MANUFACTURING`（調香中） | **不可** | — | 香料を混合すると元に戻せない |
| `MANUFACTURED`（調香完了） | **不可** | — | 既に完成済み |
| `SHIPPED`（発送済み） | **不可** | — | 配送業者に引渡し済み |
| `DELIVERED`（配達完了） | **不可** | — | 受領後は返品ポリシーへ |

**キャンセル可能ライン = 「調香開始前」（`PENDING`、`CONFIRMED`、または `PREPARING` ステータス時のみ）**

### 8.2 特別ルール

| ルール | 内容 |
|-------|------|
| 猶予時間 | 注文確定から24時間以内は無条件キャンセル可（特商法対応） |
| クリエーター起因キャンセル | クリエーター側の都合（素材欠品等）は全額返金 + ステータスを `CANCELLED` に |
| 不良品対応 | 調香後でも品質不良の場合は返金/再調香（キャンセルとは別フロー、`RETURNED` ステータス） |
| ギフト注文 | 同一キャンセルポリシー適用。贈り先変更は発送前まで可 |
| 降格保護 | 3ヶ月連続で基準未達の場合のみ降格 |

### 8.3 キャンセルフロー（顧客起点）

```
顧客がキャンセルボタン押下
  ↓
キャンセル理由選択（必須）
  ├── 注文を間違えた
  ├── 別の香りに変更したい
  ├── 配送先を変更したい
  ├── 到着が遅い
  └── その他（自由記述）
  ↓
確認画面（返金額・返金方法・返金時期を表示）
  ↓
キャンセル確定
  ↓
1. 注文ステータスを `CANCELLED` に変更
2. `order_status_history` に記録（理由含む）
3. Stripe 返金処理（全額）
4. `payments.status` を `refunded` に更新
5. 在庫を戻す
6. キャンセル確認メールを顧客に送信
7. クリエーターに通知
  ↓
キャンセル完了画面
```

### 8.4 Server Action

```typescript
// actions/order.ts

const cancelOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    'wrong_order',        // 注文を間違えた
    'change_fragrance',   // 別の香りに変更したい
    'change_address',     // 配送先を変更したい
    'delivery_slow',      // 到着が遅い
    'other',              // その他
  ]),
  detail: z.string().max(500).optional(),
});
```

**処理:**
1. 注文ステータスが `PENDING`、`CONFIRMED`、または `PREPARING` であることを確認
2. それ以外のステータスの場合はエラー「調香が開始されたためキャンセルできません」
3. Stripe `refunds.create()` で全額返金（`PENDING` の場合はCheckout Sessionのexpire処理）
4. `orders.status` を `CANCELLED` に更新
5. `payments.status` を `refunded` に更新
6. 在庫を `product_variants.stock` に戻す
7. `order_status_history` にキャンセル記録（理由・詳細含む）
8. キャンセル確認メールを送信
9. クリエーターにキャンセル通知を送信

### 8.5 UI仕様

| 状態 | UI表示 |
|------|--------|
| キャンセル可能（`PENDING` / `CONFIRMED` / `PREPARING`） | 赤い「キャンセル」ボタンを表示 + 「キャンセル可」ラベル |
| キャンセル不可（`MANUFACTURING` 以降） | ボタン非表示 |
| キャンセル済み | 注文一覧: opacity:0.6 + 理由表示、詳細: キャンセル情報セクション |

### 8.6 メール通知

| トリガー | メール種別 | 送信先 | 内容 |
|---------|-----------|--------|------|
| キャンセル確定 | キャンセル確認メール | 顧客 | 注文番号、キャンセル理由、返金額、返金時期 |
| キャンセル確定 | キャンセル通知メール | クリエーター | 注文番号、キャンセル理由 |
| 返金完了 | 返金完了メール | 顧客 | 返金額、返金方法、処理日 |

### 8.7 orders テーブル追加カラム

```typescript
// 既存の orders テーブルに追加
cancelledAt: timestamp('cancelled_at'),
cancelReason: varchar('cancel_reason', { length: 30 }),
  // wrong_order | change_fragrance | change_address | delivery_slow | other
cancelDetail: text('cancel_detail'),
```

### 8.8 返金ポリシー

| 状態 | 返金率 | 条件 |
|------|--------|------|
| PENDING（決済前） | 100% | 即時キャンセル可（Checkout Session expire） |
| CONFIRMED（決済完了〜24h以内） | 100% | 全額返金 |
| CONFIRMED / PREPARING（24h超〜調香開始前） | 90% | 手数料10%控除 |
| MANUFACTURING 以降 | 0% | キャンセル不可 |
| SHIPPED（発送済み） | 0% | 返品受付後に個別対応 |
| DELIVERED（配達完了） | 0% | 返品受付後に個別対応 |

**計算式:**
```typescript
function calculateRefund(order: Order): number {
  const hoursSinceConfirmed = (Date.now() - order.confirmedAt.getTime()) / (1000 * 60 * 60);

  if (order.status === 'PENDING') return order.totalYen;
  if (order.status === 'CONFIRMED' && hoursSinceConfirmed <= 24) return order.totalYen;
  if (['CONFIRMED', 'PREPARING'].includes(order.status) && hoursSinceConfirmed > 24) {
    return Math.floor(order.totalYen * 0.9);
  }
  return 0; // MANUFACTURING以降はキャンセル不可、SHIPPED/DELIVERED は返品で個別対応
}
```

**ロイヤリティの扱い:** 全額返金時はロイヤリティも取消。部分返金時はロイヤリティも90%に調整。

### 8.9 注文タイムアウト処理

| イベント | タイムアウト | 処理 |
|---------|------------|------|
| Stripe Checkout Session | 30分 | Stripe側で自動期限切れ → Webhook `checkout.session.expired` → `PENDING` → `CANCELLED` |
| CONFIRMED → SHIPPED 未遷移 | 7日 | バッチジョブで警告通知を管理者に送信 |
| SHIPPED → DELIVERED 未遷移 | 30日 | バッチジョブでステータスを自動的に DELIVERED に変更 |

**バッチジョブスケジュール:** 毎日 06:00 JST に `checkOrderTimeouts()` を実行

### 8.10 ビジネス制約

| 制約 | 値 | 根拠 |
|------|-----|------|
| 最低注文金額 | なし | 少額注文も許容（送料でカバー） |
| 最大注文数 | 1注文あたり10アイテム | 在庫・製造キャパシティ |
| 1日あたりの注文上限 | ユーザーあたり5回 | 不正注文防止 |
| カートアイテム上限 | 20アイテム | UX・パフォーマンス |
| 調合リクエスト上限 | ユーザーあたり10回/日 | AI API コスト管理 |
| レシピ公開上限 | クリエーターあたり50レシピ | プラットフォーム品質管理 |

---

## 9. トランザクション設計（FM-033, RPN=432）

### 9.1 createOrder() トランザクション境界

`createOrder()` の以下の10ステップを `db.transaction()` 内で実行し、原子性を保証する。

```typescript
async function createOrder(userId: string, input: CreateOrderInput) {
  return await db.transaction(async (tx) => {
    // 1. カートアイテム取得 & 在庫確認
    const cartItems = await tx.query.cartItems.findMany({
      where: eq(cartItems.userId, userId),
    });
    if (cartItems.length === 0) throw new Error('カートが空です');

    // 2. 商品価格の再取得（楽観ロック: updated_at チェック）
    const products = await tx.query.products.findMany({
      where: inArray(products.id, cartItems.map(i => i.productId)),
    });

    // 3. 在庫数の減算（排他制御: FOR UPDATE）
    for (const item of cartItems) {
      const result = await tx.execute(sql`
        UPDATE products SET stock = stock - ${item.quantity}
        WHERE id = ${item.productId} AND stock >= ${item.quantity}
      `);
      if (result.rowCount === 0) {
        throw new Error(`在庫不足: ${item.productId}`);
      }
    }

    // 4. 送料計算
    const shippingFee = calculateShipping(cartItems);

    // 5. クーポン適用（該当時）
    const discount = input.couponCode
      ? await applyCoupon(tx, input.couponCode, cartItems)
      : 0;

    // 6. 注文レコード作成
    const [order] = await tx.insert(orders).values({
      userId,
      status: 'PENDING',
      subtotalYen: calculateSubtotal(cartItems, products),
      shippingFeeYen: shippingFee,
      discountYen: discount,
      totalYen: calculateTotal(cartItems, products, shippingFee, discount),
      shippingAddressId: input.shippingAddressId,
    }).returning();

    // 7. 注文明細作成
    await tx.insert(orderItems).values(
      cartItems.map(item => ({
        orderId: order.id,
        productId: item.productId,
        recipeId: item.recipeId,
        quantity: item.quantity,
        unitPriceYen: products.find(p => p.id === item.productId)!.priceYen,
      }))
    );

    // 8. Stripe Payment Intent 作成
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.totalYen,
      currency: 'jpy',
      metadata: { orderId: order.id },
    });

    // 9. 決済情報記録
    await tx.insert(payments).values({
      orderId: order.id,
      stripePaymentIntentId: paymentIntent.id,
      amount: order.totalYen,
      status: 'PENDING',
    });

    // 10. カートクリア
    await tx.delete(cartItems).where(eq(cartItems.userId, userId));

    return { order, clientSecret: paymentIntent.client_secret };
  });
}
```

### 9.2 ロールバック条件

| 失敗箇所 | ロールバック範囲 | 補足処理 |
|---------|--------------|---------|
| 在庫不足（Step 3） | 全ステップロールバック | エラーメッセージで不足商品を通知 |
| Stripe API エラー（Step 8） | 全ステップロールバック | Sentry にエラー送信 |
| DB制約違反 | 全ステップロールバック | Sentry にエラー送信 |

> **注意**: Stripe Payment Intent 作成（Step 8）が成功後にDB書き込み（Step 9-10）が失敗した場合、Payment Intent はキャンセルする必要がある。`try-catch` の `catch` ブロックで `stripe.paymentIntents.cancel()` を呼び出す。

---

## 10. Webhook冪等性設計（FM-034, RPN=448）

### 10.1 processed_webhook_events テーブル

```typescript
// packages/db/src/schema/payments.ts に追加
export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  payload: jsonb('payload'), // デバッグ用に元ペイロードを保存
});
```

### 10.2 4段階処理フロー

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  // Stage 1: Stripe署名検証
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Stage 2: event_id 重複チェック
  const existing = await db.query.processedWebhookEvents.findFirst({
    where: eq(processedWebhookEvents.eventId, event.id),
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Stage 3: イベント処理
  await handleWebhookEvent(event);

  // Stage 4: event_id 記録
  await db.insert(processedWebhookEvents).values({
    eventId: event.id,
    eventType: event.type,
    payload: event.data.object,
  });

  return NextResponse.json({ received: true });
}
```

### 10.3 リトライ時の冪等保証

| シナリオ | 処理 |
|---------|------|
| Stage 2 で重複検出 | 200 OK を返却（Stripeのリトライを停止） |
| Stage 3 で処理失敗 | event_id 未記録のため次回リトライで再処理 |
| Stage 4 で記録失敗 | 次回リトライで Stage 3 が再実行される（処理は冪等であること） |

> **冪等性の前提**: `handleWebhookEvent()` 内の各処理は冪等である必要がある。例: `checkout.session.completed` では、注文ステータスが既に `CONFIRMED` の場合はスキップする。

---

## 11. ステータス遷移バリデーション（FM-022, RPN=336）

### 11.1 許可遷移マップ

```typescript
// lib/order/status-transitions.ts
import type { OrderStatus } from '@/db/schema/orders';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:       ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:     ['PREPARING', 'CANCELLED'],
  PREPARING:     ['MANUFACTURING', 'CANCELLED'],
  MANUFACTURING: ['MANUFACTURED'],
  MANUFACTURED:  ['SHIPPED'],
  SHIPPED:       ['DELIVERED'],
  DELIVERED:     ['RETURNED'],
  CANCELLED:     [],  // 最終ステータス
  RETURNED:      [],  // 最終ステータス
} as const;
```

### 11.2 ガード関数

```typescript
export function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): void {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
      `Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
    );
  }
}
```

### 11.3 適用箇所

```typescript
// services/order-service.ts
async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  userId: string,
): Promise<void> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) throw new Error('Order not found');

  // ガード関数でバリデーション
  validateStatusTransition(order.status, newStatus);

  await db.update(orders)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}
```

### 11.4 DB制約による二重防御

```sql
-- マイグレーションで追加
ALTER TABLE orders ADD CONSTRAINT chk_order_status
  CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'MANUFACTURING', 'MANUFACTURED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'));

-- トリガーによる遷移制約（オプション）
CREATE OR REPLACE FUNCTION validate_order_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('DELIVERED', 'CANCELLED', 'RETURNED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status: %', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_status_transition
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_transition();
```

---

## 12. パフォーマンスインデックス（FM-026, RPN=180）

### 12.1 追加インデックス一覧

| テーブル | カラム | インデックス名 | 用途 |
|---------|--------|--------------|------|
| `orders` | `user_id` | `idx_orders_user_id` | ユーザー別注文一覧 |
| `orders` | `status` | `idx_orders_status` | ステータス別フィルタ |
| `order_items` | `order_id` | `idx_order_items_order_id` | 注文別明細取得 |
| `order_items` | `recipe_id` | `idx_order_items_recipe_id` | レシピ別売上集計 |
| `order_items` | `product_id` | `idx_order_items_product_id` | 商品別売上集計 |

### 12.2 Drizzle ORM インデックス定義

```typescript
// packages/db/src/schema/orders.ts
import { index } from 'drizzle-orm/pg-core';

// orders テーブルに追加
export const ordersUserIdIdx = index('idx_orders_user_id').on(orders.userId);
export const ordersStatusIdx = index('idx_orders_status').on(orders.status);

// order_items テーブルに追加
export const orderItemsOrderIdIdx = index('idx_order_items_order_id').on(orderItems.orderId);
export const orderItemsRecipeIdIdx = index('idx_order_items_recipe_id').on(orderItems.recipeId);
export const orderItemsProductIdIdx = index('idx_order_items_product_id').on(orderItems.productId);
```

---

## 13. Stripe SDK 抽象化設計（FM-048, RPN=140）

### 13.1 課題

`stripe.ts` および `order-service.ts` が Stripe SDK に直接依存しており、決済プロバイダの変更やテスト時のモック差し替えが困難。

### 13.2 抽象化レイヤー設計

```typescript
// lib/payment/payment-provider.ts

/** 決済プロバイダの共通インターフェース */
export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
  retrieveSession(sessionId: string): Promise<CheckoutSession>;
  constructWebhookEvent(body: string, signature: string): Promise<WebhookEvent>;
}

export interface CreateCheckoutParams {
  lineItems: Array<{
    name: string;
    priceInYen: number;
    quantity: number;
  }>;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  status: 'complete' | 'expired' | 'open';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  metadata: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}
```

### 13.3 Stripe 実装

```typescript
// lib/payment/stripe-provider.ts
import Stripe from 'stripe';
import { env } from '@/lib/env';
import type { PaymentProvider, CreateCheckoutParams, CheckoutSession, WebhookEvent } from './payment-provider';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

export const stripeProvider: PaymentProvider = {
  async createCheckoutSession(params) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: params.lineItems.map(item => ({
        price_data: {
          currency: 'jpy',
          product_data: { name: item.name },
          unit_amount: item.priceInYen,
        },
        quantity: item.quantity,
      })),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
    return mapSession(session);
  },

  async retrieveSession(sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return mapSession(session);
  },

  async constructWebhookEvent(body, signature) {
    const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    return { id: event.id, type: event.type, data: event.data.object as Record<string, unknown> };
  },
};

function mapSession(session: Stripe.Checkout.Session): CheckoutSession {
  return {
    id: session.id,
    status: session.status as CheckoutSession['status'],
    paymentStatus: session.payment_status as CheckoutSession['paymentStatus'],
    metadata: (session.metadata ?? {}) as Record<string, string>,
  };
}
```

### 13.4 依存性注入

```typescript
// lib/payment/index.ts
import type { PaymentProvider } from './payment-provider';
import { stripeProvider } from './stripe-provider';

/** 決済プロバイダのシングルトン。テスト時にモック差し替え可能 */
let provider: PaymentProvider = stripeProvider;

export function getPaymentProvider(): PaymentProvider {
  return provider;
}

/** テスト用: プロバイダを差し替える */
export function setPaymentProvider(p: PaymentProvider): void {
  provider = p;
}
```

### 13.5 order-service.ts への適用

```typescript
// 修正前
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 修正後
import { getPaymentProvider } from '@/lib/payment';

export async function createCheckoutSession(orderId: string) {
  const payment = getPaymentProvider();
  const session = await payment.createCheckoutSession({
    lineItems: orderItems.map(item => ({
      name: item.recipe.name,
      priceInYen: item.priceAtPurchase,
      quantity: item.quantity,
    })),
    successUrl: `${env.NEXT_PUBLIC_BASE_URL}/orders/${orderId}/success`,
    cancelUrl: `${env.NEXT_PUBLIC_BASE_URL}/cart`,
    metadata: { orderId },
  });
  return session;
}
```

### 13.6 テスト時のモック例

```typescript
// __tests__/order-service.test.ts
import { setPaymentProvider } from '@/lib/payment';
import type { PaymentProvider } from '@/lib/payment/payment-provider';

const mockProvider: PaymentProvider = {
  createCheckoutSession: vi.fn().mockResolvedValue({
    id: 'test_session_id',
    status: 'open',
    paymentStatus: 'unpaid',
    metadata: { orderId: 'test-order-1' },
  }),
  retrieveSession: vi.fn(),
  constructWebhookEvent: vi.fn(),
};

beforeEach(() => setPaymentProvider(mockProvider));
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | B-01修正: 注文ステータスのステートマシン統一。9ステータス全てUPPERCASE化、`PENDING`追加、`payment_failed`廃止。§2.8処理フロー、§3.1-3.3ステータス定義・遷移・Stripe連携、§4.2-4.3フィルター・アクション、§7.3 DBスキーマ、§8.1-8.5キャンセルポリシー、§8.8返金ポリシー、§8.9タイムアウト、§10.3冪等性、§11.1遷移マップ（9ステータス完全版）、§11.4 DB制約を修正 |
| 2026-02-17 | B-07修正: product_variants への相互参照を追加（§7.2, §7.4 にコメント、§7.9 ER図に product_variants ボックスとFK線を追加） |
| 2026-02-17 | FMEA対応: Stripe SDK抽象化設計（§13）を追加 |
| 2026-02-17 | FMEA対応: トランザクション設計（§9）、Webhook冪等性（§10）、ステータス遷移バリデーション（§11）、インデックス追加（§12）を追加 |
| 2026-02-17 | 注文ステータス遷移図（セクション3.3）を追加 |
| 2026-02-17 | B4-B8 ビジネスルール定義を追加 |
| 2026-02-15 | キャンセルポリシー追加。`preparing` ステータス追加。 |
