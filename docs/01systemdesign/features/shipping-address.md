# 配送先住所管理 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 対象機能 | 配送先住所の登録・管理 |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |
| 更新日 | 2026-02-15 |

---

## 1. 機能概要

ユーザーが複数の配送先住所を登録・管理し、チェックアウト時に選択できる機能。

---

## 2. 配送先CRUD

### 2.1 Server Action 一覧

| Action | 説明 | 権限 |
|--------|------|------|
| `createAddress` | 配送先新規登録 | CUSTOMER |
| `updateAddress` | 配送先更新 | CUSTOMER（自分のもの） |
| `deleteAddress` | 配送先削除（論理削除） | CUSTOMER（自分のもの） |
| `setDefaultAddress` | デフォルト配送先設定 | CUSTOMER（自分のもの） |
| `getAddresses` | 配送先一覧取得 | CUSTOMER（自分のもの） |
| `lookupPostalCode` | 郵便番号から住所検索 | CUSTOMER |

### 2.2 配送先登録フォーム

```
┌─────────────────────────────────────────────────┐
│  配送先を追加                                     │
│                                                  │
│  お名前 *                                        │
│  [吉岡 太郎                           ]          │
│                                                  │
│  郵便番号 *                                      │
│  [100-0001    ] [住所を検索]                     │
│                                                  │
│  都道府県 *                                      │
│  [東京都 ▼]                                      │
│                                                  │
│  市区町村 *                                      │
│  [千代田区                             ]          │
│                                                  │
│  番地 *                                          │
│  [千代田1-1-1                          ]          │
│                                                  │
│  建物名・部屋番号                                 │
│  [千代田マンション 101号室              ]          │
│                                                  │
│  電話番号 *                                      │
│  [090-1234-5678                        ]          │
│                                                  │
│  ラベル                                          │
│  (●) 自宅  ( ) 勤務先  ( ) 実家  ( ) その他      │
│                                                  │
│  □ デフォルトの配送先に設定する                    │
│                                                  │
│  [キャンセル]                    [保存]            │
└─────────────────────────────────────────────────┘
```

### 2.3 Zodスキーマ

```typescript
const addressSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(50),
  postalCode: z.string()
    .regex(/^\d{3}-?\d{4}$/, '正しい郵便番号を入力してください'),
  prefecture: z.string().min(1, '都道府県を選択してください'),
  city: z.string().min(1, '市区町村を入力してください').max(100),
  street: z.string().min(1, '番地を入力してください').max(200),
  building: z.string().max(200).optional(),
  phone: z.string()
    .regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, '正しい電話番号を入力してください'),
  label: z.enum(['home', 'work', 'parents', 'other']).default('home'),
  isDefault: z.boolean().default(false),
});
```

### 2.4 createAddress 処理

```typescript
// Server Action: createAddress
```

**処理:**
1. セッションからユーザーID取得
2. Zodバリデーション
3. 郵便番号をハイフンなし形式に正規化 (`1000001`)
4. `isDefault = true` の場合、既存のデフォルトを解除
5. `shipping_addresses` テーブルにINSERT
6. 初回登録時は自動的にデフォルトに設定
7. `revalidatePath` で再検証

### 2.5 updateAddress 処理

**処理:**
1. セッションからユーザーID取得
2. 対象アドレスの所有者チェック
3. Zodバリデーション
4. `isDefault` 変更時は既存デフォルトを解除
5. UPDATE実行
6. `revalidatePath` で再検証

### 2.6 deleteAddress 処理

**処理:**
1. セッションからユーザーID取得
2. 対象アドレスの所有者チェック
3. 未完了の注文で使用中でないことを確認
4. 論理削除 (`deletedAt` を設定)
5. 削除対象がデフォルトの場合、最も新しい住所を新デフォルトに設定
6. `revalidatePath` で再検証

---

## 3. デフォルト配送先

| ルール | 説明 |
|--------|------|
| 初回登録 | 最初に登録した住所が自動的にデフォルト |
| 切替 | 他の住所をデフォルトにすると既存デフォルトは解除 |
| 削除時 | デフォルト住所を削除した場合、最新の住所が新デフォルト |
| 唯一性 | デフォルトは常に1件のみ |
| チェックアウト | デフォルト住所が配送先の初期選択値 |

---

## 4. 郵便番号自動検索

### 4.1 API

外部API: [zipcloud](https://zipcloud.ibsnet.co.jp/api/search) を使用

**リクエスト:**
```
GET https://zipcloud.ibsnet.co.jp/api/search?zipcode=1000001
```

**レスポンス例:**
```json
{
  "status": 200,
  "results": [
    {
      "zipcode": "1000001",
      "prefcode": "13",
      "address1": "東京都",
      "address2": "千代田区",
      "address3": "千代田"
    }
  ]
}
```

### 4.2 実装

```typescript
const lookupPostalCodeSchema = z.object({
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/),
});
```

**処理:**
1. 郵便番号のハイフンを除去
2. zipcloud API を呼び出し
3. 結果がある場合、都道府県・市区町村・町域をフォームに自動入力
4. 結果がない場合、「該当する住所が見つかりませんでした」を表示

**UX:**
- 郵便番号を7桁入力完了時に自動検索（デバウンス300ms）
- または「住所を検索」ボタンクリックで手動検索
- 検索中はローディングインジケーター表示

---

## 5. ラベル

| 値 | 表示名 | アイコン |
|-----|--------|---------|
| `home` | 自宅 | Home |
| `work` | 勤務先 | Briefcase |
| `parents` | 実家 | Heart |
| `other` | その他 | MapPin |

- デフォルト: `home`
- ラベルは住所一覧での視認性向上のために使用
- チェックアウト時の配送先選択でラベルを表示

---

## 6. バリデーション

### 6.1 フィールド別バリデーション

| フィールド | 必須 | 最大長 | バリデーション |
|-----------|------|--------|---------------|
| name | ○ | 50文字 | 空白不可 |
| postalCode | ○ | 8文字 | `/^\d{3}-?\d{4}$/` |
| prefecture | ○ | - | 47都道府県のいずれか |
| city | ○ | 100文字 | 空白不可 |
| street | ○ | 200文字 | 空白不可 |
| building | × | 200文字 | - |
| phone | ○ | 15文字 | `/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/` |
| label | × | - | `home` / `work` / `parents` / `other` |
| isDefault | × | - | boolean |

### 6.2 都道府県リスト

```typescript
const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;
```

### 6.3 登録上限

| ルール | 値 |
|--------|-----|
| 1ユーザーあたりの最大登録数 | 10件 |
| 超過時のメッセージ | 「配送先は最大10件まで登録できます。不要な配送先を削除してください。」 |

---

## 7. 配送先一覧画面

```
┌─────────────────────────────────────────────────┐
│  配送先管理                        [+ 新規追加]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  🏠 自宅                           [デフォルト]  │
│  吉岡 太郎                                       │
│  〒100-0001 東京都千代田区千代田1-1-1             │
│  千代田マンション 101号室                         │
│  TEL: 090-1234-5678                              │
│  [編集]  [削除]                                   │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  💼 勤務先                                       │
│  吉岡 太郎                                       │
│  〒150-0001 東京都渋谷区神宮前1-1-1               │
│  TEL: 03-1234-5678                               │
│  [編集]  [削除]  [デフォルトに設定]                │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 8. DBスキーマ

### 8.1 shipping_addresses テーブル

```typescript
export const shippingAddresses = pgTable('shipping_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 50 }).notNull(),
  postalCode: varchar('postal_code', { length: 8 }).notNull(), // ハイフンなし 7桁
  prefecture: varchar('prefecture', { length: 10 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  street: varchar('street', { length: 200 }).notNull(),
  building: varchar('building', { length: 200 }),
  phone: varchar('phone', { length: 15 }).notNull(),
  label: varchar('label', { length: 10 }).default('home').notNull(),
    // home | work | parents | other
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

### 8.2 インデックス

```typescript
export const shippingAddressesIdx = {
  userIdx: index('shipping_addresses_user_idx').on(shippingAddresses.userId),
  userDefaultIdx: index('shipping_addresses_user_default_idx').on(shippingAddresses.userId, shippingAddresses.isDefault),
};
```

### 8.3 ER図

```
┌──────────┐  1     N  ┌─────────────────────────────┐
│  users   │──────────>│   shipping_addresses         │
│          │           │                              │
│ id       │           │ id                           │
│ name     │           │ userId (FK → users.id)       │
│ email    │           │ name                         │
│          │           │ postalCode                   │
│          │           │ prefecture                   │
│          │           │ city                         │
│          │           │ street                       │
│          │           │ building                     │
│          │           │ phone                        │
│          │           │ label                        │
│          │           │ isDefault                    │
│          │           │ createdAt                    │
│          │           │ updatedAt                    │
│          │           │ deletedAt                    │
└──────────┘           └──────────────┬──────────────┘
                                      │ 1
                                      │
                                      │ N
                              ┌───────▼──────┐
                              │   orders     │
                              │              │
                              │ shippingAddressId │
                              │ (FK)         │
                              └──────────────┘
```
