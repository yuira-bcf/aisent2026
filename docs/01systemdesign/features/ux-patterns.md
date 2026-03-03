# UXパターン設計書

> KyaraInnovate — オーダーメイド香水プラットフォーム

---

## 1. 概要

本書はアプリケーション全体で統一的に使用するUXパターン（空状態、ローディング状態、エラー状態）の設計を定義する。

---

## 2. 空状態（Empty State）設計（FM-028, RPN=128）

### 2.1 課題

全画面でデータが0件の場合の表示が未定義であり、ユーザーが「読み込みエラー」と「データなし」を区別できない。

### 2.2 空状態パターン定義

| 画面 | 空状態メッセージ | アクション | アイコン |
|------|----------------|-----------|---------|
| レシピ一覧 | 「まだレシピがありません」 | 「調合を始める」ボタン | 🧪 ビーカー |
| カート | 「カートは空です」 | 「レシピを探す」ボタン | 🛒 カート |
| 注文履歴 | 「注文履歴がありません」 | 「レシピを探す」ボタン | 📦 パッケージ |
| レビュー一覧 | 「まだレビューがありません」 | 「最初のレビューを書く」ボタン | ✍️ ペン |
| 調合履歴 | 「調合履歴がありません」 | 「調合を始める」ボタン | 🎨 パレット |
| お気に入り | 「お気に入りがありません」 | 「レシピを探す」ボタン | ❤️ ハート |
| 通知 | 「通知はありません」 | なし | 🔔 ベル |
| クリエイターレシピ一覧 | 「まだレシピを公開していません」 | 「レシピを作成する」ボタン | ➕ プラス |
| 検索結果 | 「検索条件に一致するレシピがありません」 | 「条件を変更する」リンク | 🔍 検索 |
| 管理者ダッシュボード | 「データがありません」 | なし | 📊 チャート |

### 2.3 共通コンポーネント設計

```typescript
// components/ui/empty-state.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-6 max-w-md">{description}</p>
      )}
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}
```

### 2.4 使用例

```tsx
// app/orders/page.tsx
export default async function OrdersPage() {
  const orders = await getOrders();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12 text-gray-400" />}
        title="注文履歴がありません"
        description="お気に入りのレシピを見つけて、オーダーメイド香水を注文しましょう。"
        action={{ label: 'レシピを探す', href: '/recipes' }}
      />
    );
  }

  return <OrderList orders={orders} />;
}
```

---

## 3. ローディング状態設計（FM-029, RPN=96）

### 3.1 課題

画面遷移時やデータ取得時のローディング表示が未定義であり、ユーザーが操作結果を認識できない。

### 3.2 ローディングパターン分類

| パターン | 用途 | 実装方法 |
|---------|------|---------|
| ページローディング | 画面遷移時 | Next.js `loading.tsx` |
| データローディング | Server Component のデータ取得 | React `Suspense` + スケルトン |
| アクションローディング | ボタン押下後の処理中 | `useTransition` / `useFormStatus` |
| インラインローディング | 部分的な更新 | ローカルstate + スピナー |

### 3.3 スケルトンコンポーネント設計

```typescript
// components/ui/skeleton.tsx
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />
  );
}

// components/recipe/recipe-card-skeleton.tsx
export function RecipeCardSkeleton() {
  return (
    <div className="rounded-lg border p-4">
      <Skeleton className="h-48 w-full mb-4" />     {/* 画像 */}
      <Skeleton className="h-5 w-3/4 mb-2" />        {/* タイトル */}
      <Skeleton className="h-4 w-1/2 mb-2" />        {/* クリエイター名 */}
      <Skeleton className="h-4 w-1/4" />              {/* 価格 */}
    </div>
  );
}

// components/recipe/recipe-list-skeleton.tsx
export function RecipeListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

### 3.4 loading.tsx パターン（画面単位）

```typescript
// app/recipes/loading.tsx
import { RecipeListSkeleton } from '@/components/recipe/recipe-list-skeleton';

export default function RecipesLoading() {
  return (
    <div className="container mx-auto py-8">
      <Skeleton className="h-8 w-48 mb-6" />  {/* ページタイトル */}
      <RecipeListSkeleton />
    </div>
  );
}
```

各画面の `loading.tsx`:

| 画面パス | スケルトン内容 |
|---------|-------------|
| `/recipes` | 6枚のレシピカードスケルトン |
| `/recipes/:id` | 画像 + 詳細テキスト + レビュー欄 |
| `/cart` | カートアイテム × 3行 + 合計欄 |
| `/orders` | 注文カード × 3行 |
| `/blend` | キーワード選択エリア + 結果表示エリア |
| `/creator/dashboard` | 統計カード × 4 + テーブルスケルトン |
| `/admin` | ダッシュボードウィジェット × 6 |

### 3.5 Suspense パターン（コンポーネント単位）

```tsx
// app/recipes/[id]/page.tsx
import { Suspense } from 'react';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import { ReviewList } from '@/components/review/review-list';
import { ReviewListSkeleton } from '@/components/review/review-list-skeleton';

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);

  return (
    <div>
      <RecipeDetail recipe={recipe} />

      {/* レビューリストは独立してストリーミング */}
      <Suspense fallback={<ReviewListSkeleton />}>
        <ReviewList recipeId={params.id} />
      </Suspense>
    </div>
  );
}
```

### 3.6 ボタンアクションローディング

```tsx
// components/ui/submit-button.tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending} {...props}>
      {pending ? (
        <span className="flex items-center gap-2">
          <Spinner className="h-4 w-4" />
          処理中...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
```

---

## 4. エラー状態設計（補足）

### 4.1 エラー表示パターン

| パターン | 用途 | 実装方法 |
|---------|------|---------|
| ページエラー | サーバーエラー、404 | Next.js `error.tsx` / `not-found.tsx` |
| フォームエラー | バリデーションエラー | インラインエラーメッセージ |
| トーストエラー | 非同期操作の失敗 | トースト通知コンポーネント |

### 4.2 error.tsx パターン

```tsx
// app/recipes/error.tsx
'use client';

export default function RecipesError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">エラーが発生しました</h2>
      <p className="text-sm text-gray-500 mb-6">{error.message}</p>
      <button onClick={reset} className="btn-primary">
        もう一度試す
      </button>
    </div>
  );
}
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | 初版作成: 空状態設計（§2）、ローディング状態設計（§3）、エラー状態設計（§4） |

---

*最終更新: 2026年2月17日*
