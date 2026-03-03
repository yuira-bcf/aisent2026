# 領収書・インボイス 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 対象機能 | 領収書発行・PDF生成・インボイス制度対応 |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |
| 最終更新日 | 2026-02-15 |

---

## 1. 概要

注文完了後に顧客が領収書を表示・ダウンロード・メール送信できる機能。
日本のインボイス制度（適格請求書等保存方式）に準拠。

### 1.1 機能一覧

| 機能 | 説明 | 権限 |
|------|------|------|
| 領収書表示 | 注文詳細から領収書をブラウザ表示 | CUSTOMER |
| PDFダウンロード | 領収書をPDFとしてダウンロード | CUSTOMER |
| メール送信 | 領収書PDFをメールで送信 | CUSTOMER |
| 領収書再発行 | 発行済み領収書の再ダウンロード | CUSTOMER |
| 管理者発行 | 管理画面から任意の注文の領収書発行 | ADMIN |

---

## 2. インボイス制度（適格請求書）準拠要件

### 2.1 法的必須記載事項

| No | 項目 | 内容 | ソース |
|----|------|------|--------|
| 1 | 適格請求書発行事業者の氏名又は名称 | KyaraInnovate株式会社 | `ec_settings.company_name` |
| 2 | 登録番号 | T + 13桁 | `ec_settings.invoice_registration_number` |
| 3 | 取引年月日 | 注文日 | `orders.created_at` |
| 4 | 取引内容 | 商品名・数量・単価 | `order_items` |
| 5 | 税率ごとに区分して合計した対価の額 | 10%対象/8%対象（軽減税率） | 計算 |
| 6 | 税率ごとに区分した消費税額等 | 税率別の消費税額 | 計算 |
| 7 | 書類の交付を受ける事業者の氏名又は名称 | 顧客名 | `users.name` + `addresses` |

### 2.2 税率区分

| 税率 | 対象 | 備考 |
|------|------|------|
| 10%（標準税率） | 香水商品・送料・ギフトラッピング | 現在の全商品が対象 |
| 8%（軽減税率） | 飲食料品等 | 現時点では該当なし（将来の拡張用に表示枠を確保） |

### 2.3 消費税計算ロジック

```typescript
// 内税方式: 税込金額から税額を算出
function calculateTax(totalIncludingTax: number, taxRate: number): {
  taxExcluded: number;
  tax: number;
} {
  const tax = Math.floor(totalIncludingTax * taxRate / (1 + taxRate));
  return {
    taxExcluded: totalIncludingTax - tax,
    tax,
  };
}

// 使用例
const { taxExcluded, tax } = calculateTax(5400, 0.10);
// taxExcluded = 4909, tax = 491
```

**端数処理:** 切り捨て（`Math.floor`）— `ec_settings.tax_rounding` の設定に従う。

---

## 3. 領収書テンプレート構造

### 3.1 レイアウト

```
┌──────────────────────────────────────────────┐
│                                              │
│  領 収 書              No. KI-20260215-001   │
│  RECEIPT / INVOICE     発行日: 2026年2月15日  │
│                                              │
│══════════════════════════════════════════════│
│                                              │
│  山田 花子 様                                 │
│  〒150-0001 東京都渋谷区神宮前1-2-3          │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│           合計金額（税込）                     │
│            ¥5,400                            │
│        うち消費税額 ¥491                      │
│                                              │
├──────────────────────────────────────────────┤
│  ご注文明細                                   │
│                                              │
│  商品名              数量    単価     金額    │
│  ─────────────────────────────────────       │
│  Sunset Rose          1    ¥4,800   ¥4,800  │
│   30ml / Fresh Floral                        │
│   by shimizu                                 │
│                                              │
├──────────────────────────────────────────────┤
│  小計                              ¥4,800    │
│  送料（通常配送）                    ¥600     │
│  割引                                 ¥0     │
│  ギフトラッピング                      ¥0     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  合計（税込）                      ¥5,400    │
│                                              │
├──────────────────────────────────────────────┤
│  消費税内訳                                   │
│                                              │
│  税率区分         税抜金額     消費税         │
│  ─────────────────────────────────────       │
│  10%対象          ¥4,909       ¥491          │
│  8%対象（軽減税率）  —           —           │
│                                              │
├──────────────────────────────────────────────┤
│  お支払い情報                                 │
│                                              │
│  お支払い方法    クレジットカード (VISA ****3456) │
│  お支払い日      2026年2月15日                │
│  注文番号        #KI-20260215-001            │
│                                              │
├──────────────────────────────────────────────┤
│  発行者                                      │
│                                              │
│  KyaraInnovate株式会社                        │
│  〒100-0001 東京都千代田区千代田1-1-1         │
│  TEL: 03-XXXX-XXXX                          │
│  support@kyarainnovate.com                   │
│                                              │
│  ┌─────────────────────────────────┐         │
│  │ 適格請求書発行事業者登録番号      │         │
│  │ T1234567890123                  │         │
│  └─────────────────────────────────┘         │
│                                              │
├──────────────────────────────────────────────┤
│  この領収書は電子的に発行されたものです。       │
│  上記の金額を正に領収いたしました。            │
└──────────────────────────────────────────────┘
```

### 3.2 セクション定義

| セクション | 内容 | データソース |
|-----------|------|-------------|
| ヘッダー | 「領収書」タイトル、番号、発行日 | `orders.order_number`, `orders.created_at` |
| 宛名 | 顧客名、住所 | `users.name`, `addresses` |
| 合計金額 | 税込合計、消費税額（大きく表示） | `orders.total`, `orders.tax` |
| 注文明細 | 商品名、容量、カテゴリ、クリエーター名、数量、単価、金額 | `order_items` join `product_variants` |
| 金額内訳 | 小計、送料、割引、ギフトラッピング、合計 | `orders.*` |
| 消費税内訳 | 税率区分ごとの税抜金額と消費税額 | 計算 |
| お支払い情報 | 支払方法、支払日、注文番号 | `payments`, `orders` |
| 発行者情報 | 会社名、住所、TEL、メール、登録番号 | `ec_settings` |
| フッター | 電子発行の旨、領収文言 | 固定テキスト |

---

## 4. PDF生成

### 4.1 技術選定

| ライブラリ | 用途 |
|-----------|------|
| `@react-pdf/renderer` | React コンポーネントからPDF生成 |

**選定理由:**
- React コンポーネントで直感的にレイアウト定義可能
- 日本語フォント対応（Noto Sans JP を埋め込み）
- Server Component / Route Handler から生成可能
- SSRでPDFバイナリを返却できる

### 4.2 Route Handler

```typescript
// app/api/receipt/[orderId]/route.ts

import { renderToBuffer } from '@react-pdf/renderer';
import { ReceiptDocument } from '@/components/receipt/receipt-pdf';

export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  // 1. 認証チェック（注文の所有者 or ADMIN）
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // 2. 注文データ取得
  const order = await getOrderWithDetails(params.orderId);
  if (!order) return new Response('Not Found', { status: 404 });

  // 3. 権限チェック
  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 });
  }

  // 4. 決済完了チェック
  if (order.status === 'payment_failed') {
    return new Response('Payment not completed', { status: 400 });
  }

  // 5. EC設定取得（会社情報・登録番号）
  const settings = await getEcSettings();

  // 6. PDF生成
  const buffer = await renderToBuffer(
    <ReceiptDocument order={order} settings={settings} />
  );

  // 7. レスポンス
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${order.orderNumber}.pdf"`,
    },
  });
}
```

### 4.3 PDF コンポーネント構成

```
components/receipt/
├── receipt-pdf.tsx         # PDFドキュメント本体（@react-pdf/renderer）
├── receipt-preview.tsx     # ブラウザ表示用（HTML版、モバイル対応）
└── receipt-styles.ts       # PDF用スタイル定義
```

### 4.4 フォント設定

```typescript
import { Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: '/fonts/NotoSansJP-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/NotoSansJP-Bold.ttf', fontWeight: 'bold' },
  ],
});
```

---

## 5. Server Actions

### 5.1 メール送信

```typescript
// actions/receipt.ts

const sendReceiptEmailSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email().optional(), // 未指定時はユーザーのメール
});
```

**処理:**
1. 注文データ取得・権限チェック
2. PDF生成（`renderToBuffer`）
3. Resend API でメール送信（PDF添付）
4. 送信履歴を記録

### 5.2 領収書データ型

```typescript
type ReceiptData = {
  // ヘッダー
  receiptNumber: string;     // = orders.order_number
  issuedDate: Date;          // = 発行日（通常は注文日）

  // 宛名
  customerName: string;
  customerAddress: string;
  customerPostalCode: string;

  // 注文明細
  items: {
    productName: string;
    volume: string;           // "30ml"
    category: string;         // "Fresh Floral"
    creatorName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];

  // 金額
  subtotal: number;
  discount: number;
  giftWrappingFee: number;
  shippingFee: number;
  total: number;

  // 消費税内訳
  taxBreakdown: {
    rate: number;             // 0.10 or 0.08
    label: string;            // "10%対象" or "8%対象（軽減税率）"
    taxExcluded: number;
    tax: number;
  }[];

  // 支払い
  paymentMethod: string;      // "クレジットカード (VISA ****3456)"
  paidAt: Date;

  // 発行者
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  invoiceRegistrationNumber: string;  // "T1234567890123"
};
```

---

## 6. UI仕様

### 6.1 アクセス経路

| 画面 | アクション | 遷移先 |
|------|-----------|--------|
| 注文詳細 | 「領収書を表示」ボタン | 領収書プレビュー画面 |
| 領収書プレビュー | 「PDFダウンロード」ボタン | PDF生成 → ダウンロード |
| 領収書プレビュー | 「メールで送信」ボタン | メール送信確認 → 送信 |
| 管理画面 注文詳細 | 「領収書」ボタン | PDF生成 → ダウンロード |

### 6.2 表示条件

| 条件 | 領収書ボタン |
|------|------------|
| 決済完了（`confirmed` 以降） | 表示 |
| 決済失敗（`payment_failed`） | 非表示 |
| キャンセル済み（`cancelled`） | 表示（キャンセル前の領収書） |
| 返品済み（`returned`） | 表示（返金前の元領収書） |

### 6.3 再発行

- 何度でもダウンロード・表示可能
- 再発行時は「再発行」マークを付与（`（再発行）` テキスト追加）
- 初回発行日時を `receipt_issued_at` に記録

---

## 7. DBスキーマ

### 7.1 orders テーブル追加カラム

```typescript
// 既存の orders テーブルに追加
receiptIssuedAt: timestamp('receipt_issued_at'),  // 初回領収書発行日時
receiptCount: integer('receipt_count').default(0).notNull(),  // 発行回数
```

---

## 8. セキュリティ

| 項目 | 対策 |
|------|------|
| アクセス制御 | 注文の所有者（`orders.user_id = session.user.id`）または ADMIN のみ |
| URL推測防止 | Route Handler で認証・権限チェック必須 |
| PDF改ざん防止 | サーバーサイドで毎回生成（キャッシュしない） |
| 個人情報 | 住所・氏名を含むためHTTPS必須、ログに出力しない |

---

## 9. 将来の拡張

| 機能 | 説明 | フェーズ |
|------|------|---------|
| 電子帳簿保存法対応 | タイムスタンプ付与、検索要件対応 | Phase 3 |
| 宛名変更 | 顧客が宛名を「会社名」等に変更可能 | Phase 2 |
| 但し書き変更 | デフォルト「お品代として」、変更可能に | Phase 2 |
| 請求書モード | 法人向けに請求書（納品書兼）形式で発行 | Phase 3 |
| CSV一括出力 | 管理者が期間指定で領収書データをCSV出力 | Phase 3 |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-15 | 初版作成 |

---

*最終更新: 2026年2月15日*
