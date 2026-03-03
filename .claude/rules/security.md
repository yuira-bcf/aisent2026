---
description: セキュリティルール
globs: ["apps/web/app/api/**/*.ts", "apps/web/lib/**/*.ts"]
---

# セキュリティルール

## 認証・認可
- 全APIルートで `auth-guard.ts` によるロールチェックを実施
- ロール: CUSTOMER, CREATOR, ADMIN
- ミドルウェア（`middleware.ts`）でルートレベルの保護

## バリデーション
- 全API入力は Zod スキーマで検証
- パスワード: 最低6文字、最大128文字（bcrypt 72バイト制限対策）
- 配列入力: `.max()` で上限設定（keywords: 10, rules: 30）

## SQLインジェクション対策
- Drizzle ORM のパラメータバインディングを使用
- 生SQLは `sql` テンプレートリテラルのみ使用可

## XSS対策
- React の自動エスケープに依存
- `dangerouslySetInnerHTML` は使用禁止

## 機密情報
- `.env.local` に格納（gitignore済み）
- APIキーをクライアントサイドに露出しない
- `NEXT_PUBLIC_` プレフィックスは公開可能な値のみ

## 決済（Stripe）
- サーバーサイドでのみ Stripe SDK を使用
- Webhook は署名検証必須（`stripe.webhooks.constructEvent`）
- 決済金額はサーバーサイドで計算（クライアント値を信用しない）

## レート制限
- `rate-limiter.ts` で API エンドポイントを保護
- 認証関連エンドポイントは厳格なレート制限を適用
