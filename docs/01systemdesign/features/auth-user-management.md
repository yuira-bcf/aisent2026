# 認証・ユーザー管理 設計書

## 目次

1. [機能一覧](#1-機能一覧)
2. [画面仕様](#2-画面仕様)
3. [DBスキーマ](#3-dbスキーマ)
4. [API設計](#4-api設計)
5. [Server Actions](#5-server-actions)
6. [ミドルウェア](#6-ミドルウェア)
7. [セキュリティ](#7-セキュリティ)
8. [バリデーションルール](#8-バリデーションルール)
9. [JWT即時無効化設計（FM-042, RPN=256）](#9-jwt即時無効化設計fm-042-rpn256)
10. [INTERNAL_SERVICE_TOKEN 必須化（FM-005, RPN=280）](#10-internal_service_token-必須化fm-005-rpn280)
11. [セキュリティ実装接続チェックリスト（FM-012/036, FM-013/038, FM-014/037）](#11-セキュリティ実装接続チェックリストfm-012036-fm-013038-fm-014037)

---

## 1. 機能一覧

| # | 機能名 | 概要 | 対象ロール |
|---|--------|------|-----------|
| F-AUTH-001 | ログイン | メールアドレス + パスワードによる認証 | 全ユーザー |
| F-AUTH-002 | 新規登録 | CUSTOMER / CREATOR ロールを選択してアカウント作成 | 未認証ユーザー |
| F-AUTH-003 | ログアウト | セッション破棄・JWT無効化 | 認証済みユーザー |
| F-AUTH-004 | パスワードリセット | メールリンクによるパスワード再設定 | 全ユーザー |
| F-AUTH-005 | セッション管理 | JWTベースのセッション維持・自動更新 | 認証済みユーザー |
| F-AUTH-006 | ロールベースアクセス制御 | ロールに応じたルート・機能のアクセス制限 | 全ユーザー |

### 1.1 ログイン（F-AUTH-001）

- メールアドレスとパスワードの組み合わせで認証を行う
- 認証成功時、JWTトークンを発行しセッションを開始する
- 認証失敗時、汎用エラーメッセージを表示する（セキュリティ上、メール存在有無は明示しない）
- ログイン後は直前のページまたはダッシュボードにリダイレクトする

### 1.2 新規登録（F-AUTH-002）

- ユーザーはCUSTOMER（顧客）またはCREATOR（調香師）のいずれかのロールを選択する
- CREATOR選択時はクリエーターID（`@xxx` 形式）の入力が必須となる
- 登録完了後、自動的にログインしダッシュボードへ遷移する
- メールアドレスの重複は許可しない

### 1.3 ログアウト（F-AUTH-003）

- セッションCookieを削除しJWTを無効化する
- ログアウト後はトップページにリダイレクトする

### 1.4 パスワードリセット（F-AUTH-004）

- ユーザーがメールアドレスを入力し、リセットリンクを含むメールを送信する
- リセットトークンは有効期限付き（1時間）で発行する
- トークン検証後、新しいパスワードを設定できる
- セキュリティ上、未登録メールアドレスでも「送信しました」と表示する

### 1.5 セッション管理（F-AUTH-005）

- JWTトークンによるステートレスなセッション管理
- トークンの有効期限は30日間
- クライアントサイドでのセッション状態取得はNextAuth.jsの `useSession` フックを使用

### 1.6 ロールベースアクセス制御（F-AUTH-006）

| ロール | アクセス可能ルート | 説明 |
|--------|-------------------|------|
| CUSTOMER | `/`, `/fragrance/*`, `/mypage/*`, `/order/*` | 香りの閲覧・注文・マイページ |
| CREATOR | `/`, `/fragrance/*`, `/creator/*` | 上記に加え、レシピ管理・クリエーターダッシュボード |
| ADMIN | `/`, `/admin/*` | 全機能 + 管理画面 |
| 未認証 | `/`, `/fragrance/*`（閲覧のみ）, `/auth/*` | 公開ページの閲覧と認証画面 |

---

## 2. 画面仕様

### 2.1 ログイン画面（`/auth/signin`）

**レイアウト:**
中央配置のカード型フォーム。ロゴ + タイトル「ログイン」を上部に表示。

**フィールド:**

| フィールド名 | type | placeholder | 必須 |
|-------------|------|-------------|------|
| メールアドレス | email | `example@email.com` | Yes |
| パスワード | password | `パスワードを入力` | Yes |

**UI要素:**

- 「ログイン」ボタン（Submit）
- 「パスワードをお忘れですか？」リンク → `/auth/forgot-password`
- 「アカウントをお持ちでない方」リンク → `/auth/signup`

**バリデーションエラーメッセージ:**

| 条件 | メッセージ |
|------|-----------|
| メール未入力 | `メールアドレスを入力してください` |
| メール形式不正 | `正しいメールアドレスの形式で入力してください` |
| パスワード未入力 | `パスワードを入力してください` |
| 認証失敗 | `メールアドレスまたはパスワードが正しくありません` |
| サーバーエラー | `ログインに失敗しました。しばらくしてからお試しください` |

**動作フロー:**

1. ユーザーがフォームに入力し「ログイン」をクリック
2. クライアントサイドバリデーション実行
3. Server Action `loginAction` を呼び出し
4. 成功 → `callbackUrl` またはダッシュボードにリダイレクト
5. 失敗 → エラーメッセージを表示

### 2.2 新規登録画面（`/auth/signup`）

**レイアウト:**
中央配置のカード型フォーム。ロゴ + タイトル「アカウント作成」を上部に表示。

**フィールド:**

| フィールド名 | type | placeholder | 必須 | 備考 |
|-------------|------|-------------|------|------|
| お名前 | text | `山田 太郎` | Yes | 本名 |
| ニックネーム | text | `タロウ` | Yes | 表示名 |
| メールアドレス | email | `example@email.com` | Yes | |
| パスワード | password | `8文字以上（大小英数字を含む）` | Yes | |
| パスワード（確認） | password | `パスワードを再入力` | Yes | |
| ロール選択 | radio | - | Yes | CUSTOMER / CREATOR |
| クリエーターID | text | `@your_creator_id` | CREATOR時のみ | ロールがCREATOR時に表示 |

**ロール選択UI:**

```
[ ] カスタマー（Customer）
    香りを注文・購入されるお客様

[ ] クリエーター（Creator）
    香りのレシピを作成・管理する調香師
```

CREATORを選択すると、クリエーターIDフィールドがアニメーション付きで表示される。

**UI要素:**

- 「アカウントを作成」ボタン（Submit）
- 「すでにアカウントをお持ちの方」リンク → `/auth/signin`

**バリデーションエラーメッセージ:**

| 条件 | メッセージ |
|------|-----------|
| お名前未入力 | `お名前を入力してください` |
| ニックネーム未入力 | `ニックネームを入力してください` |
| ニックネーム文字数不正 | `ニックネームは2〜20文字で入力してください` |
| メール未入力 | `メールアドレスを入力してください` |
| メール形式不正 | `正しいメールアドレスの形式で入力してください` |
| メール重複 | `このメールアドレスは既に登録されています` |
| パスワード未入力 | `パスワードを入力してください` |
| パスワード要件不足 | `パスワードは8文字以上で、大文字・小文字・数字を含めてください` |
| パスワード不一致 | `パスワードが一致しません` |
| クリエーターID未入力 | `クリエーターIDを入力してください` |
| クリエーターID形式不正 | `クリエーターIDは3〜20文字の英数字とアンダースコアのみ使用できます` |
| クリエーターID重複 | `このクリエーターIDは既に使用されています` |

### 2.3 パスワードリセット画面

#### 2.3.1 メールアドレス入力画面（`/auth/forgot-password`）

**フィールド:**

| フィールド名 | type | placeholder | 必須 |
|-------------|------|-------------|------|
| メールアドレス | email | `登録済みのメールアドレス` | Yes |

**UI要素:**

- 「リセットメールを送信」ボタン
- 「ログインに戻る」リンク → `/auth/signin`

**送信完了後:**
「パスワードリセットのメールを送信しました。メールに記載されたリンクからパスワードを再設定してください。」と表示する。

#### 2.3.2 パスワード再設定画面（`/auth/reset-password?token=xxx`）

**フィールド:**

| フィールド名 | type | placeholder | 必須 |
|-------------|------|-------------|------|
| 新しいパスワード | password | `8文字以上（大小英数字を含む）` | Yes |
| パスワード（確認） | password | `パスワードを再入力` | Yes |

**エラー:**

| 条件 | メッセージ |
|------|-----------|
| トークン無効/期限切れ | `このリンクは無効または期限切れです。再度パスワードリセットを申請してください。` |

### 2.4 認証モーダル（未ログイン時の注文/保存操作）

**トリガー:**
未認証ユーザーが以下の操作を行った場合に表示:

- 香りの注文ボタンをクリック
- お気に入り保存ボタンをクリック
- マイページへのアクセスを試みた場合

**モーダル内容:**

```
─────────────────────────────
  ログインが必要です

  この機能を利用するにはログインしてください。

  [ログイン]  [新規登録]

  [閉じる]
─────────────────────────────
```

- 「ログイン」クリック → `/auth/signin?callbackUrl={currentPath}` に遷移
- 「新規登録」クリック → `/auth/signup?callbackUrl={currentPath}` に遷移
- 認証完了後、元の操作を継続できるよう `callbackUrl` を保持する

---

## 3. DBスキーマ

### 3.1 users テーブル

```sql
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  nickname      VARCHAR(20)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER'
                             CHECK (role IN ('CUSTOMER', 'CREATOR', 'ADMIN')),
  creator_id    VARCHAR(20)  UNIQUE,
  email_verified TIMESTAMPTZ,
  image         VARCHAR(500),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**カラム詳細:**

| カラム名 | 型 | 制約 | 説明 |
|---------|------|------|------|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | ユーザー一意識別子 |
| `name` | `VARCHAR(100)` | NOT NULL | 本名 |
| `nickname` | `VARCHAR(20)` | NOT NULL | 表示名（2〜20文字） |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | メールアドレス（ログインID） |
| `password` | `VARCHAR(255)` | NOT NULL | bcryptハッシュ化済みパスワード |
| `role` | `VARCHAR(20)` | NOT NULL, DEFAULT `'CUSTOMER'`, CHECK制約 | ユーザーロール（CUSTOMER / CREATOR / ADMIN） |
| `creator_id` | `VARCHAR(20)` | UNIQUE, NULLABLE | クリエーター識別子（`@xxx` の `xxx` 部分）。CREATORロールの場合に必須 |
| `email_verified` | `TIMESTAMPTZ` | NULLABLE | メール認証完了日時。NULLの場合は未認証 |
| `image` | `VARCHAR(500)` | NULLABLE | プロフィール画像URL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | レコード作成日時 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | レコード更新日時 |

**インデックス:**

```sql
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE UNIQUE INDEX idx_users_creator_id ON users (creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at);
```

### 3.2 password_reset_tokens テーブル

```sql
CREATE TABLE password_reset_tokens (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64)  NOT NULL UNIQUE,  -- SHA-256ハッシュ（平文トークンは保存しない）
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**カラム詳細:**

| カラム名 | 型 | 制約 | 説明 |
|---------|------|------|------|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | トークン一意識別子 |
| `user_id` | `UUID` | NOT NULL, FK → `users.id`, ON DELETE CASCADE | 対象ユーザー |
| `token_hash` | `VARCHAR(64)` | NOT NULL, UNIQUE | リセットトークンのSHA-256ハッシュ（平文トークンは保存しない） |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | トークン有効期限（発行から1時間） |
| `used_at` | `TIMESTAMPTZ` | NULLABLE | 使用済み日時。NULLの場合は未使用 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` | レコード作成日時 |

**インデックス:**

```sql
CREATE UNIQUE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
```

### 3.3 Drizzle ORM スキーマ定義

```typescript
// src/db/schema/users.ts
import { pgTable, uuid, varchar, timestamptz, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  nickname: varchar('nickname', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('CUSTOMER'),
  creatorId: varchar('creator_id', { length: 20 }).unique(),
  emailVerified: timestamptz('email_verified'),
  image: varchar('image', { length: 500 }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_email').on(table.email),
  index('idx_users_role').on(table.role),
  index('idx_users_created_at').on(table.createdAt),
  check('role_check', sql`${table.role} IN ('CUSTOMER', 'CREATOR', 'ADMIN')`),
]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamptz('expires_at').notNull(),
  usedAt: timestamptz('used_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_password_reset_tokens_token_hash').on(table.tokenHash),
  index('idx_password_reset_tokens_user_id').on(table.userId),
  index('idx_password_reset_tokens_expires_at').on(table.expiresAt),
]);

// 型エクスポート
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
```

---

## 4. API設計

### 4.1 POST `/api/auth/signin`

NextAuth.js v5のCredentials Providerが内部的に処理する。カスタムServer Actionから呼び出す。

**リクエスト:**

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**成功レスポンス（200）:**

```json
{
  "user": {
    "id": "uuid",
    "name": "山田 太郎",
    "nickname": "タロウ",
    "email": "user@example.com",
    "role": "CUSTOMER",
    "image": null
  }
}
```

**エラーレスポンス:**

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 401 | `INVALID_CREDENTIALS` | メールアドレスまたはパスワードが正しくありません |
| 422 | `VALIDATION_ERROR` | 入力値のバリデーションエラー |
| 429 | `TOO_MANY_REQUESTS` | リクエスト回数の上限を超えました。しばらくしてからお試しください |
| 500 | `INTERNAL_ERROR` | サーバーエラーが発生しました |

### 4.2 POST `/api/auth/signup`

**リクエスト:**

```json
{
  "name": "山田 太郎",
  "nickname": "タロウ",
  "email": "user@example.com",
  "password": "Password123",
  "confirmPassword": "Password123",
  "role": "CREATOR",
  "creatorId": "taro_yamada"
}
```

**成功レスポンス（201）:**

```json
{
  "user": {
    "id": "uuid",
    "name": "山田 太郎",
    "nickname": "タロウ",
    "email": "user@example.com",
    "role": "CREATOR",
    "creatorId": "taro_yamada",
    "image": null
  }
}
```

**エラーレスポンス:**

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 409 | `EMAIL_ALREADY_EXISTS` | このメールアドレスは既に登録されています |
| 409 | `CREATOR_ID_ALREADY_EXISTS` | このクリエーターIDは既に使用されています |
| 422 | `VALIDATION_ERROR` | 入力値のバリデーションエラー（詳細は `errors` フィールドに配列で返却） |
| 429 | `TOO_MANY_REQUESTS` | リクエスト回数の上限を超えました |
| 500 | `INTERNAL_ERROR` | サーバーエラーが発生しました |

**エラーレスポンス例（422）:**

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力値に誤りがあります",
  "errors": [
    { "field": "password", "message": "パスワードは8文字以上で、大文字・小文字・数字を含めてください" },
    { "field": "creatorId", "message": "クリエーターIDは3〜20文字の英数字とアンダースコアのみ使用できます" }
  ]
}
```

### 4.3 POST `/api/auth/signout`

NextAuth.js v5が内部的に処理する。

**リクエスト:**
ボディ不要（セッションCookieから認証情報を取得）

**成功レスポンス（200）:**

```json
{
  "message": "ログアウトしました"
}
```

**エラーレスポンス:**

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 500 | `INTERNAL_ERROR` | サーバーエラーが発生しました |

### 4.4 POST `/api/auth/forgot-password`

**リクエスト:**

```json
{
  "email": "user@example.com"
}
```

**成功レスポンス（200）:**

```json
{
  "message": "パスワードリセットのメールを送信しました"
}
```

> セキュリティ上、メールアドレスの登録有無に関わらず同じレスポンスを返す。

**エラーレスポンス:**

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 422 | `VALIDATION_ERROR` | 正しいメールアドレスの形式で入力してください |
| 429 | `TOO_MANY_REQUESTS` | リクエスト回数の上限を超えました |
| 500 | `INTERNAL_ERROR` | サーバーエラーが発生しました |

**内部処理:**

1. メールアドレスでユーザーを検索
2. ユーザーが存在する場合のみ、トークンを生成して `password_reset_tokens` に保存
3. リセットリンクを含むメールを送信
4. 既存の未使用トークンがある場合は無効化（新しいトークンで上書き）

### 4.5 PUT `/api/auth/reset-password`

**リクエスト:**

```json
{
  "token": "reset-token-string",
  "password": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

**成功レスポンス（200）:**

```json
{
  "message": "パスワードを再設定しました"
}
```

**エラーレスポンス:**

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 400 | `INVALID_TOKEN` | このリンクは無効または期限切れです |
| 400 | `TOKEN_ALREADY_USED` | このリンクは既に使用されています |
| 422 | `VALIDATION_ERROR` | パスワードの要件を満たしていません |
| 500 | `INTERNAL_ERROR` | サーバーエラーが発生しました |

**内部処理:**

1. トークンを `password_reset_tokens` から検索
2. 有効期限と使用済みフラグを検証
3. パスワードをbcryptでハッシュ化して更新
4. トークンの `used_at` を現在時刻に更新

### 4.6 GET `/api/auth/session`

NextAuth.js v5が内部的に処理する。

**成功レスポンス（200 - 認証済み）:**

```json
{
  "user": {
    "id": "uuid",
    "name": "山田 太郎",
    "nickname": "タロウ",
    "email": "user@example.com",
    "role": "CUSTOMER",
    "image": null
  },
  "expires": "2026-03-15T00:00:00.000Z"
}
```

**成功レスポンス（200 - 未認証）:**

```json
{}
```

---

## 5. Server Actions

### 5.1 ファイル構成

```
src/
  actions/
    auth.ts          # 認証関連Server Actions
  lib/
    validations/
      auth.ts        # Zodバリデーションスキーマ
```

### 5.2 Zodバリデーションスキーマ

```typescript
// src/lib/validations/auth.ts
import { z } from 'zod';

// ログインスキーマ
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('正しいメールアドレスの形式で入力してください'),
  password: z
    .string()
    .min(1, 'パスワードを入力してください'),
});

// 新規登録スキーマ
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'お名前を入力してください')
    .max(100, 'お名前は100文字以内で入力してください'),
  nickname: z
    .string()
    .min(2, 'ニックネームは2〜20文字で入力してください')
    .max(20, 'ニックネームは2〜20文字で入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('正しいメールアドレスの形式で入力してください'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'パスワードは大文字・小文字・数字を含めてください'
    ),
  confirmPassword: z
    .string()
    .min(1, 'パスワード（確認）を入力してください'),
  role: z
    .enum(['CUSTOMER', 'CREATOR'], {
      errorMap: () => ({ message: 'ロールを選択してください' }),
    }),
  creatorId: z
    .string()
    .regex(
      /^[a-zA-Z0-9_]{3,20}$/,
      'クリエーターIDは3〜20文字の英数字とアンダースコアのみ使用できます'
    )
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
}).refine((data) => {
  if (data.role === 'CREATOR') {
    return data.creatorId && data.creatorId.length > 0;
  }
  return true;
}, {
  message: 'クリエーターIDを入力してください',
  path: ['creatorId'],
});

// パスワードリセット申請スキーマ
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('正しいメールアドレスの形式で入力してください'),
});

// パスワード再設定スキーマ
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'トークンが必要です'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'パスワードは大文字・小文字・数字を含めてください'
    ),
  confirmPassword: z
    .string()
    .min(1, 'パスワード（確認）を入力してください'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

// 型エクスポート
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

### 5.3 Server Actions定義

```typescript
// src/actions/auth.ts
'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/db';
import { users, passwordResetTokens } from '@/db/schema/users';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

// 共通のアクション結果型
type ActionResult = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

// ログインアクション
export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  // バリデーション
  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn('credentials', {
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });
  } catch (error) {
    return {
      success: false,
      message: 'メールアドレスまたはパスワードが正しくありません',
    };
  }

  return { success: true };
}

// 新規登録アクション
export async function registerAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    name: formData.get('name') as string,
    nickname: formData.get('nickname') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
    role: formData.get('role') as string,
    creatorId: formData.get('creatorId') as string,
  };

  // バリデーション
  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // メール重複チェック
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, validated.data.email),
  });
  if (existingUser) {
    return {
      success: false,
      errors: { email: ['このメールアドレスは既に登録されています'] },
    };
  }

  // クリエーターID重複チェック
  if (validated.data.role === 'CREATOR' && validated.data.creatorId) {
    const existingCreator = await db.query.users.findFirst({
      where: eq(users.creatorId, validated.data.creatorId),
    });
    if (existingCreator) {
      return {
        success: false,
        errors: { creatorId: ['このクリエーターIDは既に使用されています'] },
      };
    }
  }

  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(validated.data.password, 12);

  // ユーザー作成
  await db.insert(users).values({
    name: validated.data.name,
    nickname: validated.data.nickname,
    email: validated.data.email,
    password: hashedPassword,
    role: validated.data.role,
    creatorId: validated.data.role === 'CREATOR' ? validated.data.creatorId : null,
  });

  // 登録後に自動ログイン
  await signIn('credentials', {
    email: validated.data.email,
    password: validated.data.password,
    redirect: false,
  });

  return { success: true };
}

// ログアウトアクション
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
```

---

## 6. ミドルウェア

### 6.1 認証ミドルウェア

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 公開ルート（認証不要）
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/fragrance',         // 香り一覧（閲覧のみ）
  '/api/auth',          // NextAuth.jsエンドポイント
];

// ロール別保護ルート
const roleRoutes: Record<string, string[]> = {
  CREATOR: ['/creator'],
  ADMIN: ['/admin'],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 公開ルートはスキップ
  if (isPublicRoute(pathname)) {
    // 認証済みユーザーが認証ページにアクセスした場合はリダイレクト
    if (session && pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL(getDashboardUrl(session.user.role), req.url));
    }
    return NextResponse.next();
  }

  // 未認証ユーザーはログインページへリダイレクト
  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // ロールベースアクセス制御
  for (const [role, routes] of Object.entries(roleRoutes)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      if (session.user.role !== role && session.user.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }

  return NextResponse.next();
});

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

function getDashboardUrl(role: string): string {
  switch (role) {
    case 'CREATOR': return '/creator/dashboard';
    case 'ADMIN': return '/admin/dashboard';
    default: return '/mypage';
  }
}

export const config = {
  matcher: [
    /*
     * 以下を除く全てのルートにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico (ファビコン)
     * - public配下のファイル
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 6.2 リダイレクトルール一覧

| 条件 | 遷移元 | 遷移先 |
|------|--------|--------|
| 未認証 → 保護ルート | `/mypage/*`, `/order/*` 等 | `/auth/signin?callbackUrl={元URL}` |
| 認証済み → 認証ページ | `/auth/signin`, `/auth/signup` | ロール別ダッシュボード |
| CUSTOMER → CREATORルート | `/creator/*` | `/`（トップページ） |
| CUSTOMER → ADMINルート | `/admin/*` | `/`（トップページ） |
| CREATOR → ADMINルート | `/admin/*` | `/`（トップページ） |
| ログアウト | 任意 | `/`（トップページ） |
| ログイン成功（callbackUrlあり） | `/auth/signin` | `callbackUrl` |
| ログイン成功（callbackUrlなし） | `/auth/signin` | ロール別ダッシュボード |
| 新規登録成功 | `/auth/signup` | ロール別ダッシュボード |

### 6.3 ロール別ダッシュボード

| ロール | ダッシュボードURL |
|--------|-----------------|
| CUSTOMER | `/mypage` |
| CREATOR | `/creator/dashboard` |
| ADMIN | `/admin/dashboard` |

---

## 7. セキュリティ

### 7.1 パスワードハッシュ

- **アルゴリズム:** bcryptjs
- **saltRounds:** 12
- **実装:**

```typescript
import bcrypt from 'bcryptjs';

// ハッシュ化
const hashedPassword = await bcrypt.hash(plainPassword, 12);

// 検証
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

- パスワードは平文で保存しない
- ハッシュ化はサーバーサイドでのみ実行する
- saltRounds=12は現時点で十分なセキュリティと処理速度のバランスを提供する

### 7.2 JWT設定

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@/lib/validations/auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, validated.data.email),
        });
        if (!user) return null;

        const isValidPassword = await bcrypt.compare(
          validated.data.password,
          user.password
        );
        if (!isValidPassword) return null;

        return {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
          creatorId: user.creatorId,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.nickname = user.nickname;
        token.creatorId = user.creatorId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.nickname = token.nickname as string;
        session.user.creatorId = token.creatorId as string | null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
```

**環境変数:**

```
NEXTAUTH_SECRET=<ランダムな32文字以上の文字列>
NEXTAUTH_URL=http://localhost:3000 (開発環境)
```

### 7.3 CSRF保護

- NextAuth.js v5はデフォルトでCSRFトークンによる保護を提供する
- `POST` リクエストには自動的にCSRFトークンが付与される
- Server Actionsは Next.js が自動的にCSRF保護を適用する

### 7.4 Rate Limiting

ブルートフォース攻撃を防ぐため、以下のエンドポイントにRate Limitingを適用する。

| エンドポイント | 制限 | ウィンドウ |
|--------------|------|-----------|
| `/api/auth/signin` | 5回 | 15分 |
| `/api/auth/signup` | 3回 | 15分 |
| `/api/auth/forgot-password` | 3回 | 15分 |
| `/api/auth/reset-password` | 5回 | 15分 |

**実装方針:**

```typescript
// src/lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  interval: number;   // ウィンドウ（ミリ秒）
  uniqueTokenPerInterval: number; // ウィンドウ内の最大ユニークトークン数
};

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval,
    ttl: options.interval,
  });

  return {
    check: (limit: number, token: string): { success: boolean; remaining: number } => {
      const tokenCount = tokenCache.get(token) || [0];
      const currentUsage = tokenCount[0];

      if (currentUsage >= limit) {
        return { success: false, remaining: 0 };
      }

      tokenCache.set(token, [currentUsage + 1]);
      return { success: true, remaining: limit - currentUsage - 1 };
    },
  };
}
```

### 7.5 追加セキュリティ対策

| 対策 | 説明 |
|------|------|
| パスワード要件 | 8文字以上、大文字・小文字・数字を必須とする |
| ユーザー列挙防止 | ログイン失敗時・パスワードリセット時に汎用メッセージを返す |
| セッション固定攻撃防止 | ログイン成功時にセッションIDを再生成する（NextAuth.jsが自動対応） |
| HTTPOnly Cookie | JWTトークンはHTTPOnly Cookieに保存し、JavaScriptからアクセスできないようにする |
| Secure Cookie | 本番環境ではSecureフラグを有効にし、HTTPS経由のみでCookieを送信する |
| SameSite属性 | CookieのSameSite属性を `lax` に設定する |
| パスワードリセットトークン | crypto.randomBytesで生成し、有効期限1時間、1回限り使用可能 |

### 7.6 パスワードリセット

#### 7.6.1 フロー概要

パスワードリセットは以下の5段階で実行する。

```
1. リクエスト:    ユーザーがメールアドレスを入力して送信
2. トークン生成:  crypto.randomBytes(32) で32バイトのランダムトークンを生成
3. メール送信:    リセットリンク（トークン含む）をメールで送信
4. トークン検証:  ユーザーがリンクをクリック → トークンをSHA-256ハッシュ化してDB上のハッシュと比較
5. パスワード変更: 新しいパスワードをbcryptでハッシュ化して保存、トークンを使用済みに更新
```

#### 7.6.2 トークン仕様

| 項目 | 仕様 |
|------|------|
| 生成方法 | `crypto.randomBytes(32).toString('hex')` — 64文字の16進数文字列 |
| DB保存形式 | SHA-256ハッシュ（`crypto.createHash('sha256').update(token).digest('hex')`） |
| 有効期限 | 発行から1時間 |
| 使用回数 | 1回限り（`usedAt` が設定されたトークンは無効） |
| 無効化条件 | パスワード変更完了時、新しいトークン発行時（既存の未使用トークンを無効化） |

> **セキュリティ上の理由**: トークンそのものをDBに保存せず、SHA-256ハッシュを保存する。これにより、DBが漏洩した場合でもトークンを悪用できない。URLに含まれるトークン（平文）とDBのハッシュを比較する際は `crypto.timingSafeEqual` を使用し、タイミング攻撃を防ぐ。

#### 7.6.3 レート制限

| 制限対象 | 上限 | ウィンドウ |
|---------|------|-----------|
| メールアドレスあたり | 3回 | 1時間 |
| IPアドレスあたり | 5回 | 1時間 |

#### 7.6.4 セキュリティ要件

- **定数時間比較**: トークン検証には `crypto.timingSafeEqual` を使用する
- **単一使用**: トークンは1回使用されたら即座に `usedAt` を記録し、再利用を防ぐ
- **既存トークン無効化**: 新しいリセットリクエスト時、同一ユーザーの既存未使用トークンを全て無効化する
- **パスワード変更時の全トークン無効化**: パスワード変更完了時、対象ユーザーの全ての未使用トークンを無効化する
- **ユーザー列挙防止**: 未登録メールアドレスでも「送信しました」と表示する
- **メール送信の非同期化**: メール送信はバックグラウンドで実行し、レスポンスタイムからユーザーの存在を推測されないようにする

#### 7.6.5 DBスキーマ

`password_reset_tokens` テーブル（`packages/db/src/schema/security.ts` に定義）:

| カラム | 型 | 説明 |
|--------|------|------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → users.id (CASCADE) |
| `token_hash` | `VARCHAR(64)` | SHA-256ハッシュ化されたトークン |
| `expires_at` | `TIMESTAMP` | 有効期限（発行から1時間） |
| `used_at` | `TIMESTAMP` | 使用済み日時（NULL = 未使用） |
| `created_at` | `TIMESTAMP` | 作成日時 |

### 7.7 レート制限

#### 7.7.1 概要

APIの不正利用やブルートフォース攻撃を防ぐため、Redis Sliding Windowカウンターによるレート制限を実装する。制限はユーザー単位（認証済み）とIPアドレス単位（未認証）の2軸で適用する。

#### 7.7.2 制限値

| カテゴリ | エンドポイント | 上限 | ウィンドウ | 制限キー |
|---------|--------------|------|-----------|---------|
| 一般API | `/api/*`（認証系を除く） | 100回 | 1分 | `userId` or `IP` |
| 認証系 | `/api/auth/signin`, `/api/auth/signup` | 10回 | 1分 | `IP` |
| パスワードリセット | `/api/auth/forgot-password`, `/api/auth/reset-password` | 5回 | 1分 | `email` or `IP` |
| ブレンドリクエスト | `/api/blend/*` | 30回 | 1分 | `userId` |

#### 7.7.3 実装方式: Redis Sliding Window Counter

```
キー形式: rate_limit:{category}:{identifier}:{window_start}
TTL:      ウィンドウサイズ + 1秒（自動クリーンアップ）
```

**Sliding Windowアルゴリズム:**

1. 現在のウィンドウと前のウィンドウのカウントを取得
2. 前のウィンドウのカウントに「前のウィンドウの残り割合」を掛けて加重
3. 加重値 + 現在のウィンドウのカウントが制限値を超えていないか判定
4. 許可された場合、現在のウィンドウのカウントをインクリメント

#### 7.7.4 レスポンス

制限超過時は `429 Too Many Requests` を返す。

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000045

{
  "ok": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "リクエスト回数の上限を超えました。しばらくしてからお試しください"
  }
}
```

#### 7.7.5 フォールバック

Redis接続障害時は、レート制限をバイパスしてリクエストを許可する（可用性優先）。ただし、障害発生を監査ログに記録する。

### 7.8 監査ログ

#### 7.8.1 概要

セキュリティ上重要な操作を記録し、不正アクセスの検知やインシデント調査に利用する。監査ログは改ざん防止のため追記専用とし、削除や更新は行わない。

#### 7.8.2 記録対象イベント

| アクション | 説明 | リソース |
|-----------|------|---------|
| `LOGIN` | ログイン成功 | `user` |
| `LOGIN_FAILED` | ログイン失敗 | `user` |
| `LOGOUT` | ログアウト | `user` |
| `ROLE_CHANGE` | ロール変更 | `user` |
| `ORDER_STATUS_CHANGE` | 注文ステータス変更 | `order` |
| `PAYMENT` | 決済イベント（成功/失敗） | `order` |
| `ADMIN_ACTION` | 管理者操作（ユーザー停止、データ修正等） | 対象リソース |
| `PASSWORD_RESET` | パスワードリセット実行 | `user` |
| `PASSWORD_RESET_REQUEST` | パスワードリセット申請 | `user` |
| `RECIPE_PUBLISH` | レシピ公開 | `recipe` |
| `RECIPE_UNPUBLISH` | レシピ非公開化 | `recipe` |
| `ACCOUNT_CREATE` | アカウント新規作成 | `user` |
| `ACCOUNT_DELETE` | アカウント削除 | `user` |

#### 7.8.3 DBスキーマ

`audit_logs` テーブル（`packages/db/src/schema/security.ts` に定義）:

| カラム | 型 | 説明 |
|--------|------|------|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → users.id (NULLABLE — 未認証操作の記録用) |
| `action` | `VARCHAR(50)` | アクション種別（上記の列挙値） |
| `resource` | `VARCHAR(50)` | 操作対象リソース種別（user, order, recipe 等） |
| `resource_id` | `UUID` | 操作対象リソースのID（NULLABLE） |
| `metadata` | `JSONB` | 追加情報（変更前後の値、エラー詳細等） |
| `ip_address` | `VARCHAR(45)` | リクエスト元IPアドレス（IPv6対応） |
| `user_agent` | `TEXT` | User-Agentヘッダー |
| `created_at` | `TIMESTAMP` | 記録日時 |

**インデックス:**

- `idx_audit_logs_user_id` — ユーザー別の操作履歴検索
- `idx_audit_logs_action` — アクション別の検索
- `idx_audit_logs_created_at` — 期間指定での検索
- `idx_audit_logs_resource` — リソース別の検索

#### 7.8.4 保持期間

| 区分 | 期間 | 保管場所 |
|------|------|---------|
| アクティブ | 90日 | PostgreSQL `audit_logs` テーブル |
| アーカイブ | 2年 | S3互換ストレージ（Parquet形式） |
| 削除 | 2年超過 | 自動削除 |

アーカイブは日次バッチジョブで実行する。90日を超えたレコードをParquet形式でエクスポートし、元テーブルから削除する。

#### 7.8.5 アクセス制御

- 監査ログの閲覧は `ADMIN` ロールのみ許可
- 管理画面 `/admin/audit-logs` でフィルタ付き一覧表示
- APIアクセスは `GET /api/admin/audit-logs` （ページネーション対応）

### 7.9 XSS/CSRF対策

#### 7.9.1 Content-Security-Policy（CSP）

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.stripe.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

> `script-src` にはNext.jsが生成するインラインスクリプト用のnonce値を動的に設定する。`style-src 'unsafe-inline'` はCSS-in-JSライブラリとの互換性のために許可するが、将来的にはnonce方式に移行する。

#### 7.9.2 追加セキュリティヘッダー

| ヘッダー | 値 | 目的 |
|---------|------|------|
| `X-Frame-Options` | `DENY` | クリックジャッキング防止 |
| `X-Content-Type-Options` | `nosniff` | MIMEタイプスニッフィング防止 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー情報の制限 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 不要なブラウザAPI無効化 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS強制（本番環境のみ） |
| `X-DNS-Prefetch-Control` | `off` | DNS先読み無効化 |

#### 7.9.3 CSRF対策

| レイヤー | 対策 | 説明 |
|---------|------|------|
| Cookie属性 | `SameSite=Lax` | クロスサイトリクエストでのCookie送信を制限 |
| Origin検証 | Next.js Server Actions | Next.jsが自動的にOriginヘッダーを検証 |
| CSRF Token | NextAuth.js | 認証エンドポイントにCSRFトークンを自動付与 |
| カスタムヘッダー | `X-Requested-With` | AJAX/fetchリクエスト識別（将来的な追加対策として検討） |

#### 7.9.4 XSS対策

| レイヤー | 対策 | 適用範囲 |
|---------|------|---------|
| 出力エスケープ | React デフォルトエスケープ | JSXテンプレート内の全ての変数展開 |
| 入力サニタイズ | DOMPurify | ユーザー生成コンテンツ（レシピ説明文、レビュー等） |
| `dangerouslySetInnerHTML` 禁止 | ESLintルール | コードレビューで徹底、やむを得ない場合はDOMPurify必須 |
| CSP | nonce方式 | インラインスクリプトの制限 |

**DOMPurify適用例:**

```typescript
import DOMPurify from 'isomorphic-dompurify';

// ユーザー入力のサニタイズ
const sanitized = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
  ALLOWED_ATTR: [],
});
```

#### 7.9.5 ファイルアップロード

| 対策 | 実装 |
|------|------|
| ファイルタイプ検証 | MIMEタイプ + マジックバイト検証（拡張子だけに依存しない） |
| サイズ制限 | プロフィール画像: 5MB、商品画像: 10MB |
| ファイル名サニタイズ | UUIDでリネーム、元のファイル名は使用しない |
| 保存先分離 | アップロードファイルはS3互換ストレージに保存、アプリケーションサーバーには保存しない |
| ウイルスチェック | ClamAV等によるアップロード時スキャン（将来実装） |
| 画像変換 | アップロード後にSharp等で再エンコードし、悪意あるペイロードを除去 |

---

## 8. バリデーションルール

### 8.1 メールアドレス

| ルール | 条件 | エラーメッセージ |
|--------|------|----------------|
| 必須 | 空文字でないこと | `メールアドレスを入力してください` |
| 形式 | RFC 5322準拠の形式であること | `正しいメールアドレスの形式で入力してください` |
| 最大長 | 255文字以内 | `メールアドレスは255文字以内で入力してください` |
| 重複（登録時） | 既存ユーザーと重複しないこと | `このメールアドレスは既に登録されています` |

### 8.2 パスワード

| ルール | 条件 | エラーメッセージ |
|--------|------|----------------|
| 必須 | 空文字でないこと | `パスワードを入力してください` |
| 最小長 | 8文字以上 | `パスワードは8文字以上で入力してください` |
| 大文字 | 1文字以上の大文字英字を含む | `パスワードは大文字・小文字・数字を含めてください` |
| 小文字 | 1文字以上の小文字英字を含む | （同上） |
| 数字 | 1文字以上の数字を含む | （同上） |
| 確認一致 | パスワード確認欄と一致すること | `パスワードが一致しません` |

**正規表現:**

```
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
```

### 8.3 ニックネーム

| ルール | 条件 | エラーメッセージ |
|--------|------|----------------|
| 必須 | 空文字でないこと | `ニックネームを入力してください` |
| 最小長 | 2文字以上 | `ニックネームは2〜20文字で入力してください` |
| 最大長 | 20文字以内 | `ニックネームは2〜20文字で入力してください` |

### 8.4 クリエーターID

| ルール | 条件 | エラーメッセージ |
|--------|------|----------------|
| 条件付き必須 | ロールがCREATORの場合は必須 | `クリエーターIDを入力してください` |
| 最小長 | 3文字以上 | `クリエーターIDは3〜20文字の英数字とアンダースコアのみ使用できます` |
| 最大長 | 20文字以内 | （同上） |
| 使用可能文字 | 英数字（a-z, A-Z, 0-9）とアンダースコア（_）のみ | （同上） |
| 重複 | 既存クリエーターIDと重複しないこと | `このクリエーターIDは既に使用されています` |

**正規表現:**

```
/^[a-zA-Z0-9_]{3,20}$/
```

### 8.5 お名前

| ルール | 条件 | エラーメッセージ |
|--------|------|----------------|
| 必須 | 空文字でないこと | `お名前を入力してください` |
| 最大長 | 100文字以内 | `お名前は100文字以内で入力してください` |

### 8.6 バリデーション実行タイミング

| タイミング | 実行場所 | 目的 |
|-----------|---------|------|
| フォーム入力時（onBlur） | クライアントサイド | UX向上のための即時フィードバック |
| フォーム送信時（onSubmit） | クライアントサイド | サーバーリクエスト前の事前チェック |
| Server Action実行時 | サーバーサイド | セキュリティのための最終バリデーション |
| DB制約 | データベース | データ整合性の最終保証 |

> クライアントサイドのバリデーションは利便性のためであり、セキュリティ上はサーバーサイドのバリデーションが必須。Zodスキーマを共有することで、クライアント・サーバー間のバリデーションロジックを統一する。

---

## 9. JWT即時無効化設計（FM-042, RPN=256）

### 9.1 token_blacklist テーブル

```typescript
// packages/db/src/schema/security.ts に追加
export const tokenBlacklist = pgTable('token_blacklist', {
  id: uuid('id').defaultRandom().primaryKey(),
  tokenJti: varchar('token_jti', { length: 64 }).notNull().unique(),
  revokedAt: timestamp('revoked_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});
```

**インデックス:**
- `idx_token_blacklist_jti` — JTI検索用（UNIQUE制約で自動作成）
- `idx_token_blacklist_expires_at` — クリーンアップバッチ用

### 9.2 ログアウト時のJTI登録

```typescript
// Server Action: signOut 処理内
async function revokeToken(token: JWT): Promise<void> {
  await db.insert(tokenBlacklist).values({
    tokenJti: token.jti,
    expiresAt: new Date(token.exp * 1000),
  });
}
```

### 9.3 ミドルウェアでのブラックリストチェック

```typescript
// middleware.ts に追加
async function isTokenRevoked(jti: string): Promise<boolean> {
  const entry = await db.query.tokenBlacklist.findFirst({
    where: eq(tokenBlacklist.tokenJti, jti),
  });
  return !!entry;
}

// Auth.js callbacks.jwt 内
jwt({ token }) {
  if (!token.jti) {
    token.jti = crypto.randomUUID();
  }
  return token;
},
```

> **パフォーマンス考慮**: ブラックリストチェックは全リクエストで実行されるため、Redis キャッシュ（Phase 1.5）導入後は Redis SET にJTIを格納し、O(1) で検索する。Phase 1 ではDB直接参照（インデックス付きで十分な性能）。

### 9.4 期限切れエントリのクリーンアップ

```typescript
// バッチジョブ: 日次実行（06:00 JST）
async function cleanupExpiredBlacklist(): Promise<void> {
  await db.delete(tokenBlacklist)
    .where(lt(tokenBlacklist.expiresAt, new Date()));
}
```

---

## 10. INTERNAL_SERVICE_TOKEN 必須化（FM-005, RPN=280）

### 10.1 env.ts の修正

現行の `INTERNAL_SERVICE_TOKEN` は `.optional()` で定義されているが、本番環境でのサービス間認証が無効化されるリスクがある。

**修正前:**
```typescript
INTERNAL_SERVICE_TOKEN: z.string().optional(),
```

**修正後:**
```typescript
INTERNAL_SERVICE_TOKEN: z.string().min(32,
  'INTERNAL_SERVICE_TOKEN must be at least 32 characters'),
```

### 10.2 docker-compose.yml での生成

```yaml
# docker-compose.yml
services:
  web:
    environment:
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}  # .env から読込
  ai-service:
    environment:
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}

# .env（開発用）- crypto.randomBytes(32).toString('hex') で生成
# INTERNAL_SERVICE_TOKEN=<64文字のランダム16進数文字列>
```

**生成コマンド:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 10.3 環境別の運用

| 環境 | 設定方法 | 備考 |
|------|---------|------|
| 開発 | `.env` ファイル | `crypto.randomBytes(32)` で生成 |
| CI | GitHub Secrets | `secrets.INTERNAL_SERVICE_TOKEN` |
| 本番 | Vercel Environment Variables | 手動設定、ローテーション対象 |

---

## 11. セキュリティ実装接続チェックリスト（FM-012/036, FM-013/038, FM-014/037）

設計済みの3つのセキュリティコンポーネントが未接続の状態にある。以下の手順で実装を接続する。

### 11.1 対象コンポーネント

| コンポーネント | 設計ファイル | 実装ファイル | RPN合計 |
|--------------|------------|------------|---------|
| レートリミッター | §7.7（本書） | `lib/rate-limit.ts` | FM-012: 270 + FM-036: 540 = 810 |
| 監査ログ | §7.8（本書） | `lib/audit-logger.ts` | FM-013: 280 + FM-038: 360 = 640 |
| セキュリティヘッダー | §7.9（本書） | `lib/security-headers.ts` | FM-014: 270 + FM-037: 360 = 630 |

### 11.2 Next.js middleware.ts への統合

```typescript
// apps/web/middleware.ts
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { securityHeaders } from '@/lib/security-headers';

export default auth(async (req) => {
  // 1. セキュリティヘッダー付与
  const response = NextResponse.next();
  securityHeaders(response);

  // 2. レート制限チェック（認証済みユーザーのみ）
  if (req.auth?.user) {
    const { allowed } = await checkRateLimit(
      req.auth.user.id,
      req.nextUrl.pathname,
      getRateLimitConfig(req.nextUrl.pathname),
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 },
      );
    }
  }

  return response;
});
```

### 11.3 監査ログの適用マッピング

| Server Action / API Route | 監査ログアクション | 実装ステップ |
|--------------------------|-----------------|------------|
| `POST /api/auth/signin` | `LOGIN` / `LOGIN_FAILED` | authorize コールバック内で `auditLog()` 呼出 |
| `POST /api/auth/signout` | `LOGOUT` | signOut Server Action 内で `auditLog()` 呼出 |
| `PUT /api/admin/users/:id/role` | `ROLE_CHANGE` | Server Action 内で `auditLog()` 呼出 |
| `POST /api/v1/orders` | `PAYMENT` | createOrder サービス内で `auditLog()` 呼出 |
| `PATCH /api/admin/orders/:id/status` | `ORDER_STATUS_CHANGE` | updateOrderStatus 内で `auditLog()` 呼出 |
| `POST /api/auth/forgot-password` | `PASSWORD_RESET_REQUEST` | Server Action 内で `auditLog()` 呼出 |
| `PUT /api/auth/reset-password` | `PASSWORD_RESET` | Server Action 内で `auditLog()` 呼出 |

### 11.4 セキュリティヘッダーの適用

```typescript
// lib/security-headers.ts
export function securityHeaders(response: NextResponse): void {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }
}
```

### 11.5 実装優先順序

| 優先度 | コンポーネント | 理由 |
|--------|-------------|------|
| 1 | セキュリティヘッダー | 変更量が少なく、即座にセキュリティ向上 |
| 2 | レートリミッター | DDoS/ブルートフォース防止に直結 |
| 3 | 監査ログ | 全Server Actionへの呼出追加が必要で工数大 |

---

## 12. パスワードリセットフロー設計（FM-040, RPN=240 / FM-010, RPN=192）

### 12.1 課題

`password_reset_tokens` テーブルがスキーマに定義されているが、以下が未実装：
- パスワードリセット要求・検証のサービス関数
- 対応するAPIルート
- パスワードリセット画面からのフロー

### 12.2 フロー概要

```
[ログイン画面] → 「パスワードを忘れた」リンク
    ↓
[パスワードリセット要求画面] — メールアドレス入力
    ↓ POST /api/v1/auth/forgot-password
[サーバー] — トークン生成 → password_reset_tokens に保存 → メール送信
    ↓
[メール] — リセットリンク（/reset-password?token=xxx）
    ↓
[パスワード再設定画面] — 新パスワード入力
    ↓ POST /api/v1/auth/reset-password
[サーバー] — トークン検証 → パスワード更新 → トークン無効化
```

### 12.3 サービス関数設計

```typescript
// lib/services/password-reset-service.ts

import { db } from '@/lib/db';
import { passwordResetTokens, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { hash } from 'bcryptjs';

const TOKEN_EXPIRY_HOURS = 1;
const TOKEN_LENGTH = 32;

/** 平文トークンをSHA-256ハッシュに変換する */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** リセットトークン生成・保存・メール送信 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // ユーザーが見つからなくても同じレスポンスを返す（列挙攻撃防止）
  if (!user) return;

  // 既存トークンを無効化
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      eq(passwordResetTokens.usedAt, null)
    ));

  // 新規トークン生成（平文はメール送信のみに使用、DBにはハッシュを保存）
  const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // メール送信（Resend経由 — 平文トークンをリンクに含める）
  await sendPasswordResetEmail(email, token);
}

/** トークン検証 & パスワード更新 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // 平文トークンをSHA-256ハッシュ化してDBのハッシュと比較
  const tokenHash = hashToken(token);

  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      eq(passwordResetTokens.usedAt, null),
      gt(passwordResetTokens.expiresAt, new Date())
    ),
  });

  if (!resetToken) {
    return { success: false, error: 'トークンが無効または期限切れです' };
  }

  const hashedPassword = await hash(newPassword, 12);

  await db.transaction(async (tx) => {
    // パスワード更新
    await tx.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, resetToken.userId));

    // トークン使用済みにマーク
    await tx.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));
  });

  return { success: true };
}
```

### 12.4 APIルート設計

| メソッド | パス | 認証 | 説明 |
|---------|------|------|------|
| POST | `/api/v1/auth/forgot-password` | 不要 | リセットメール送信要求 |
| POST | `/api/v1/auth/reset-password` | 不要 | 新パスワードでリセット実行 |

```typescript
// app/api/v1/auth/forgot-password/route.ts
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = forgotPasswordSchema.parse(await req.json());
  await requestPasswordReset(body.email);
  // 常に同じレスポンス（ユーザー列挙防止）
  return Response.json({ message: 'リセットメールを送信しました' });
}

// app/api/v1/auth/reset-password/route.ts
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const body = resetPasswordSchema.parse(await req.json());
  const result = await resetPassword(body.token, body.password);
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ message: 'パスワードをリセットしました' });
}
```

### 12.5 セキュリティ対策

| 対策 | 実装方法 |
|------|---------|
| ユーザー列挙防止 | 存在しないメールでも同じレスポンスを返す |
| トークン有効期限 | 1時間（TOKEN_EXPIRY_HOURS = 1） |
| トークン一意性 | crypto.randomBytes(32) — 256bit のランダム値 |
| ワンタイム使用 | `usedAt` フラグで使用済みトークンを無効化 |
| レート制限 | forgot-password に対し IP ごと 3回/時間 のレート制限適用 |
| パスワード要件 | Zod で 8文字以上128文字以下を検証 |

---

## 13. XSS対策・DOMPurify設計（FM-041, RPN=280）

### 13.1 課題

ユーザー入力を表示するコンポーネント（レビュー本文、クリエイターストーリー、調合ストーリー等）で DOMPurify によるサニタイズが行われていない。React の JSX は自動エスケープされるが、`dangerouslySetInnerHTML` 使用箇所やリッチテキスト表示でXSSリスクがある。

### 13.2 対策方針

| レイヤー | 対策 | 実装 |
|---------|------|------|
| 入力時 | Zodバリデーション | 文字列長制限、パターンマッチ |
| 保存時 | サーバーサイドサニタイズ | DOMPurify (jsdom) でHTML除去 |
| 表示時 | React自動エスケープ | JSX `{text}` による自動エスケープ |
| 例外表示 | DOMPurifyクライアント | `dangerouslySetInnerHTML` 使用時のみ |

### 13.3 サーバーサイド実装

```typescript
// lib/utils/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

/** プレーンテキスト用 — 全HTMLタグを除去 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/** リッチテキスト用 — 安全なタグのみ許可 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}
```

### 13.4 適用箇所

| データ | 入力元 | サニタイズ関数 | 表示方法 |
|--------|--------|-------------|---------|
| レビュー本文 | ユーザー入力 | `sanitizeText()` | JSX `{text}` |
| クリエイタープロフィール | クリエイター入力 | `sanitizeText()` | JSX `{text}` |
| 調合ストーリー | AI生成 | `sanitizeHtml()` | `dangerouslySetInnerHTML` |
| レシピ説明 | クリエイター入力 | `sanitizeText()` | JSX `{text}` |
| 通知メッセージ | システム生成 | サニタイズ不要 | JSX `{text}` |

### 13.5 パッケージ導入

```bash
npm install isomorphic-dompurify
```

`isomorphic-dompurify` はサーバー（jsdom ベース）とクライアント（ブラウザ DOM）の両方で動作し、Next.js の SSR/CSR 両対応。

### 13.6 Server Action への統合

```typescript
// 例: レビュー作成 Server Action
'use server';
import { sanitizeText } from '@/lib/utils/sanitize';

export async function createReview(data: ReviewInput) {
  const sanitizedBody = sanitizeText(data.body);
  const sanitizedTitle = sanitizeText(data.title);

  await db.insert(reviews).values({
    ...data,
    body: sanitizedBody,
    title: sanitizedTitle,
  });
}
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | FMEA対応: パスワードリセット設計（§12）、XSS対策・DOMPurify設計（§13）を追加 |
| 2026-02-17 | FMEA対応: JWT即時無効化（§9）、INTERNAL_SERVICE_TOKEN必須化（§10）、セキュリティ実装接続チェックリスト（§11）を追加 |
| 2026-02-15 | 初版作成 |

---

*最終更新: 2026年2月17日*
