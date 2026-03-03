# 通知システム設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | アプリ内通知・メール通知・プッシュ通知 |
| バージョン | 1.1 |
| 作成日 | 2026-02-17 |

---

## 1. 概要

ユーザーへの各種通知を管理するシステム。アプリ内通知（DB保存+リアルタイム表示）、メール通知、プッシュ通知の3チャネルをサポートする。

---

## 2. 通知タイプ

| カテゴリ | タイプ | 対象 | アプリ内 | メール | 内容 |
|---------|--------|------|---------|--------|------|
| 注文 | ORDER_CONFIRMED | CUSTOMER | ○ | ○ | 注文確定通知 |
| 注文 | ORDER_SHIPPED | CUSTOMER | ○ | ○ | 発送完了通知（追跡番号付き） |
| 注文 | ORDER_DELIVERED | CUSTOMER | ○ | - | 配達完了通知 |
| 注文 | ORDER_CANCELLED | CUSTOMER | ○ | ○ | キャンセル完了通知 |
| レビュー | REVIEW_RECEIVED | CREATOR | ○ | ○ | レシピにレビューが投稿された |
| レシピ | RECIPE_ORDERED | CREATOR | ○ | - | レシピが注文された |
| ロイヤリティ | ROYALTY_PAID | CREATOR | ○ | ○ | 月次ロイヤリティ支払完了 |
| ティア | TIER_CHANGED | CREATOR | ○ | ○ | ティアが変更された |
| システム | SYSTEM_ANNOUNCEMENT | ALL | ○ | - | システムからのお知らせ |
| クリエーター | CREATOR_APPROVED | USER | ○ | ○ | クリエーター申請が承認された |
| クリエーター | CREATOR_REJECTED | USER | ○ | ○ | クリエーター申請が却下された |

## 3. DBスキーマ（Drizzle ORM 定義）

```typescript
// packages/db/src/schema/notifications.ts

import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notificationTypeEnum = [
  'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
  'REVIEW_RECEIVED', 'RECIPE_ORDERED', 'ROYALTY_PAID', 'TIER_CHANGED',
  'SYSTEM_ANNOUNCEMENT', 'CREATOR_APPROVED', 'CREATOR_REJECTED',
] as const;
export type NotificationType = (typeof notificationTypeEnum)[number];

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull().$type<NotificationType>(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data').$type<Record<string, string>>(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('idx_notifications_user_created').on(table.userId, table.createdAt),
  index('idx_notifications_user_unread').on(table.userId, table.isRead),
]));

// ユーザー通知設定
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  emailOrderUpdates: boolean('email_order_updates').default(true).notNull(),
  emailReviews: boolean('email_reviews').default(true).notNull(),
  emailRoyalty: boolean('email_royalty').default(true).notNull(),
  emailSystem: boolean('email_system').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## 4. Server Actions（サービス実装）

```typescript
// services/notification-service.ts

import { db } from '@/db';
import { notifications, notificationPreferences } from '@/db/schema/notifications';
import { eq, and, desc } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';

/** 通知作成（アプリ内 + メール判定） */
export async function sendNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  // 1. アプリ内通知をDB保存
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data ?? null,
  });

  // 2. メール通知判定
  const prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, params.userId),
  });

  if (shouldSendEmail(params.type, prefs)) {
    await sendNotificationEmail(params);
  }
}

/** 通知一覧取得 */
export async function getNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResult<Notification>> {
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
  ]);

  return {
    items,
    pagination: {
      page, limit,
      totalItems: countResult[0].count,
      totalPages: Math.ceil(countResult[0].count / limit),
    },
  };
}

/** 未読数取得 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
    ));
  return result[0].count;
}

/** 既読処理 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId),
    ));
}

/** 全既読処理 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
    ));
}
```

## 5. メール通知テンプレート

| テンプレート | 件名 | 内容 |
|-------------|------|------|
| order-confirmed | [KyaraInnovate] ご注文を承りました | 注文詳細、配送先、合計金額 |
| order-shipped | [KyaraInnovate] 商品を発送しました | 追跡番号、配送予定日 |
| review-received | [KyaraInnovate] レシピにレビューが届きました | レシピ名、評価、コメント抜粋 |
| royalty-paid | [KyaraInnovate] ロイヤリティをお支払いしました | 金額、対象期間、明細リンク |
| creator-approved | [KyaraInnovate] クリエーター申請が承認されました | ようこそメッセージ、次のステップ |

## 6. リアルタイム通知（将来拡張）

初期リリースではポーリング（30秒間隔）で未読数を取得。
将来的に Server-Sent Events (SSE) または WebSocket でリアルタイム配信を実装。

## 7. 通知設定

ユーザーごとに通知チャネルの ON/OFF を設定可能:

| 設定 | デフォルト |
|------|----------|
| アプリ内通知 | ON（変更不可） |
| メール通知: 注文関連 | ON |
| メール通知: レビュー | ON |
| メール通知: ロイヤリティ | ON |
| メール通知: システム | ON |

---

## 8. APIルート設計

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/v1/notifications` | 通知一覧（ページネーション付き） | 必須 |
| GET | `/api/v1/notifications/unread-count` | 未読数取得 | 必須 |
| PATCH | `/api/v1/notifications/:id/read` | 個別既読 | 必須 |
| PATCH | `/api/v1/notifications/read-all` | 全既読 | 必須 |
| GET | `/api/v1/notifications/preferences` | 通知設定取得 | 必須 |
| PUT | `/api/v1/notifications/preferences` | 通知設定更新 | 必須 |

### リクエスト/レスポンス例

**GET `/api/v1/notifications?page=1&limit=20`**

レスポンス:
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "ORDER_CONFIRMED",
      "title": "ご注文を承りました",
      "body": "注文番号 #12345 を確認しました。",
      "data": { "orderId": "uuid", "orderNumber": "12345" },
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-02-17T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 42,
    "totalPages": 3
  }
}
```

**GET `/api/v1/notifications/unread-count`**

レスポンス:
```json
{ "count": 5 }
```

---

## 9. メール送信統合

### Resend を使用したメール送信基盤

```typescript
// lib/email/index.ts
import { Resend } from 'resend';
import { env } from '@/lib/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<void> {
  await resend.emails.send({
    from: 'KyaraInnovate <noreply@kyarainnovate.com>',
    to: params.to,
    subject: params.subject,
    react: params.react,
  });
}
```

### メール配信管理

- メール配信停止: 各メールフッターに「配信停止」リンクを設置。
- `/settings/notifications` 画面で通知設定変更可能。
- ユーザーの `notificationPreferences` テーブルの設定に基づき、メール送信可否を判定する。

---

## 10. 通知UIコンポーネント

### コンポーネント構成

```typescript
// components/notifications/notification-bell.tsx    — ヘッダーのベルアイコン + 未読バッジ
// components/notifications/notification-list.tsx    — 通知一覧ドロップダウン
// components/notifications/notification-item.tsx    — 個別通知カード
// app/(customer)/settings/notifications/page.tsx    — 通知設定画面
```

### NotificationBell コンポーネント

- ヘッダーに配置
- 30秒ポーリングで未読数を取得
- 未読がある場合は赤いバッジを表示
- クリックで通知一覧ドロップダウンを表示

### 通知一覧ドロップダウン

- 最新20件を表示
- 未読は太字、既読は通常
- クリックで既読にしつつ関連ページへ遷移
- 「すべて既読にする」ボタン
- 「すべての通知を見る」リンク → `/notifications`

### 通知タイプ別の遷移先

| 通知タイプ | 遷移先 |
|-----------|--------|
| ORDER_CONFIRMED / ORDER_SHIPPED / ORDER_DELIVERED / ORDER_CANCELLED | `/orders/:orderId` |
| REVIEW_RECEIVED | `/creator/recipes/:recipeId/reviews` |
| RECIPE_ORDERED | `/creator/recipes/:recipeId` |
| ROYALTY_PAID | `/creator/royalties` |
| TIER_CHANGED | `/creator/dashboard` |
| SYSTEM_ANNOUNCEMENT | `/notifications/:id` |
| CREATOR_APPROVED / CREATOR_REJECTED | `/creator/dashboard` |

---

## 11. Zodバリデーション

```typescript
// lib/validators/notification.ts

import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updatePreferencesSchema = z.object({
  emailOrderUpdates: z.boolean(),
  emailReviews: z.boolean(),
  emailRoyalty: z.boolean(),
  emailSystem: z.boolean(),
});
```

---

## 12. 通知送信トリガー実装例

各イベント発生時に `sendNotification()` を呼び出す箇所を以下に示す。

| トリガー | 呼び出し元 | パラメータ |
|---------|-----------|-----------|
| ORDER_CONFIRMED | `order-service.ts` `createOrder()` | orderId, orderNumber |
| ORDER_SHIPPED | `order-service.ts` `updateOrderStatus()` | orderId, trackingNumber |
| ORDER_DELIVERED | `order-service.ts` `updateOrderStatus()` | orderId |
| ORDER_CANCELLED | `order-service.ts` `cancelOrder()` | orderId, reason |
| REVIEW_RECEIVED | `review-service.ts` `createReview()` | recipeId, reviewerName, rating |
| RECIPE_ORDERED | `order-service.ts` `createOrder()` | recipeId, orderId |
| ROYALTY_PAID | `royalty-service.ts` `processMonthlyPayout()` | amount, period |
| TIER_CHANGED | `tier-service.ts` `updateTier()` | oldTier, newTier |
| SYSTEM_ANNOUNCEMENT | `admin/announcement-service.ts` | title, body |
| CREATOR_APPROVED | `admin/creator-approval.ts` | userId |
| CREATOR_REJECTED | `admin/creator-approval.ts` | userId, reason |

### 呼び出し例

```typescript
// order-service.ts — createOrder() 内
await sendNotification({
  userId: order.userId,
  type: 'ORDER_CONFIRMED',
  title: 'ご注文を承りました',
  body: `注文番号 #${order.orderNumber} を確認しました。`,
  data: {
    orderId: order.id,
    orderNumber: order.orderNumber,
  },
});

// review-service.ts — createReview() 内
await sendNotification({
  userId: recipe.creatorId,
  type: 'REVIEW_RECEIVED',
  title: 'レシピにレビューが届きました',
  body: `${reviewerName}さんが「${recipe.title}」に★${rating}のレビューを投稿しました。`,
  data: {
    recipeId: review.recipeId,
    reviewerName,
    rating: String(rating),
  },
});

// tier-service.ts — updateTier() 内
await sendNotification({
  userId: creator.userId,
  type: 'TIER_CHANGED',
  title: 'ティアが変更されました',
  body: `ティアが ${oldTier} から ${newTier} に変更されました。`,
  data: {
    oldTier,
    newTier,
  },
});
```

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-17 | 初版作成 |
| 2026-02-17 | B-09対応: DBスキーマをDrizzle ORM定義に書き換え、Server Actionsを具体実装に拡張、APIルート設計(§8)・メール送信統合(§9)・通知UIコンポーネント(§10)・Zodバリデーション(§11)・通知送信トリガー実装例(§12)を追加 |
