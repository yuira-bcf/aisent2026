import { db } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email/send-notification-email";
import {
  type NotificationType,
  notificationPreferences,
  notifications,
} from "@kyarainnovate/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const updateNotificationPreferencesSchema = z.object({
  emailOrderUpdates: z.boolean().optional(),
  emailReviews: z.boolean().optional(),
  emailRoyalty: z.boolean().optional(),
  emailSystem: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
};

export type NotificationPreferencesResult = {
  id: string;
  userId: string;
  emailOrderUpdates: boolean;
  emailReviews: boolean;
  emailRoyalty: boolean;
  emailSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<{ notificationId: string }> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      data: params.data ?? null,
    })
    .returning({ id: notifications.id });

  return { notificationId: row.id };
}

// ---------------------------------------------------------------------------
// getNotificationsForUser – Paginated notifications with unread count
// ---------------------------------------------------------------------------

export async function getNotificationsForUser(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: NotificationItem[]; total: number; unreadCount: number }> {
  const offset = (page - 1) * limit;

  const userWhere = eq(notifications.userId, userId);

  const [rows, [{ value: total }], [{ value: unreadCount }]] =
    await Promise.all([
      db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          data: notifications.data,
          isRead: notifications.isRead,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(userWhere)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(notifications).where(userWhere),
      db
        .select({ value: count() })
        .from(notifications)
        .where(and(userWhere, eq(notifications.isRead, false))),
    ]);

  return { items: rows, total, unreadCount };
}

// ---------------------------------------------------------------------------
// markAsRead – Mark a single notification as read (verify ownership)
// ---------------------------------------------------------------------------

export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning({ id: notifications.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// markAllAsRead – Mark all unread notifications for a user as read
// ---------------------------------------------------------------------------

export async function markAllAsRead(
  userId: string,
): Promise<{ count: number }> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    )
    .returning({ id: notifications.id });

  return { count: result.length };
}

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );

  return value;
}

// ---------------------------------------------------------------------------
// deleteNotification – Hard delete, verify ownership
// ---------------------------------------------------------------------------

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning({ id: notifications.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// getNotificationPreferences
// ---------------------------------------------------------------------------

const defaultPreferences = {
  emailOrderUpdates: true,
  emailReviews: true,
  emailRoyalty: true,
  emailSystem: true,
} as const;

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferencesResult> {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (!row) {
    const now = new Date();
    return {
      id: "",
      userId,
      ...defaultPreferences,
      createdAt: now,
      updatedAt: now,
    };
  }

  return row;
}

// ---------------------------------------------------------------------------
// updateNotificationPreferences – Upsert
// ---------------------------------------------------------------------------

export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferencesResult> {
  const [row] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      emailOrderUpdates: input.emailOrderUpdates ?? true,
      emailReviews: input.emailReviews ?? true,
      emailRoyalty: input.emailRoyalty ?? true,
      emailSystem: input.emailSystem ?? true,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        ...(input.emailOrderUpdates !== undefined && {
          emailOrderUpdates: input.emailOrderUpdates,
        }),
        ...(input.emailReviews !== undefined && {
          emailReviews: input.emailReviews,
        }),
        ...(input.emailRoyalty !== undefined && {
          emailRoyalty: input.emailRoyalty,
        }),
        ...(input.emailSystem !== undefined && {
          emailSystem: input.emailSystem,
        }),
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

// ---------------------------------------------------------------------------
// shouldSendEmail – Determine if an email should be sent for a notification type
// ---------------------------------------------------------------------------

const notificationTypeToPreferenceKey: Partial<
  Record<NotificationType, keyof typeof defaultPreferences>
> = {
  ORDER_CONFIRMED: "emailOrderUpdates",
  ORDER_SHIPPED: "emailOrderUpdates",
  ORDER_DELIVERED: "emailOrderUpdates",
  ORDER_CANCELLED: "emailOrderUpdates",
  RECIPE_ORDERED: "emailOrderUpdates",
  REVIEW_RECEIVED: "emailReviews",
  ROYALTY_PAID: "emailRoyalty",
  TIER_CHANGED: "emailSystem",
  SYSTEM_ANNOUNCEMENT: "emailSystem",
  CREATOR_APPROVED: "emailSystem",
  CREATOR_REJECTED: "emailSystem",
};

// Types that support email delivery (see design doc §2)
const emailEnabledTypes: Set<NotificationType> = new Set([
  "ORDER_CONFIRMED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "REVIEW_RECEIVED",
  "RECIPE_ORDERED",
  "ROYALTY_PAID",
  "TIER_CHANGED",
  "SYSTEM_ANNOUNCEMENT",
  "CREATOR_APPROVED",
  "CREATOR_REJECTED",
]);

export function shouldSendEmail(
  type: NotificationType,
  prefs?: {
    emailOrderUpdates: boolean;
    emailReviews: boolean;
    emailRoyalty: boolean;
    emailSystem: boolean;
  } | null,
): boolean {
  if (!emailEnabledTypes.has(type)) return false;

  // If no preferences row exists, all defaults are true
  if (!prefs) return true;

  const key = notificationTypeToPreferenceKey[type];
  if (!key) return false;

  return prefs[key];
}

// ---------------------------------------------------------------------------
// sendNotification – DB save + email determination (main entry point per §4)
// ---------------------------------------------------------------------------

export async function sendNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<{ notificationId: string; emailSent: boolean }> {
  // 1. Save in-app notification to DB
  const { notificationId } = await createNotification(params);

  // 2. Check email preferences
  const [prefsRow] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, params.userId));

  const emailSent = shouldSendEmail(params.type, prefsRow ?? null);

  // 3. Send email if preferences allow
  if (emailSent) {
    // Fire-and-forget: don't await to avoid blocking
    sendNotificationEmail(params.userId, params.type, params.data ?? {}).catch(
      (err) => {
        console.error("[notification-service] Email send failed:", err);
      },
    );
  }

  return { notificationId, emailSent };
}

// ---------------------------------------------------------------------------
// Batch notification helpers
// ---------------------------------------------------------------------------

const orderStatusNotificationMap: Record<
  string,
  { type: NotificationType; title: string; body: string }
> = {
  CONFIRMED: {
    type: "ORDER_CONFIRMED",
    title: "注文が確定しました",
    body: "ご注文が正常に確定されました。準備が整い次第発送いたします。",
  },
  SHIPPED: {
    type: "ORDER_SHIPPED",
    title: "注文が発送されました",
    body: "ご注文の商品が発送されました。お届けまでしばらくお待ちください。",
  },
  DELIVERED: {
    type: "ORDER_DELIVERED",
    title: "注文が配達されました",
    body: "ご注文の商品が配達されました。ご確認ください。",
  },
  CANCELLED: {
    type: "ORDER_CANCELLED",
    title: "注文がキャンセルされました",
    body: "ご注文がキャンセルされました。",
  },
};

export async function notifyOrderStatusChange(
  userId: string,
  orderId: string,
  newStatus: string,
): Promise<void> {
  const mapping = orderStatusNotificationMap[newStatus];
  if (!mapping) return;

  await sendNotification({
    userId,
    type: mapping.type,
    title: mapping.title,
    body: mapping.body,
    data: { orderId },
  });
}

export async function notifyCreatorNewOrder(
  creatorUserId: string,
  orderId: string,
  recipeName: string,
): Promise<void> {
  await sendNotification({
    userId: creatorUserId,
    type: "RECIPE_ORDERED",
    title: "新しい注文が入りました",
    body: `レシピ「${recipeName}」に新しい注文が入りました。`,
    data: { orderId, recipeName },
  });
}

export async function notifyCreatorNewReview(
  creatorUserId: string,
  recipeName: string,
  rating: number,
): Promise<void> {
  await sendNotification({
    userId: creatorUserId,
    type: "REVIEW_RECEIVED",
    title: "新しいレビューが投稿されました",
    body: `レシピ「${recipeName}」に${rating}つ星のレビューが投稿されました。`,
    data: { recipeName, rating },
  });
}

export async function notifyCreatorApplicationResult(
  userId: string,
  approved: boolean,
  rejectionReason?: string,
): Promise<void> {
  if (approved) {
    await sendNotification({
      userId,
      type: "CREATOR_APPROVED",
      title: "クリエイター申請が承認されました",
      body: "おめでとうございます！クリエイターとしての活動を開始できます。",
    });
  } else {
    await sendNotification({
      userId,
      type: "CREATOR_REJECTED",
      title: "クリエイター申請が却下されました",
      body: rejectionReason ?? "申請内容をご確認の上、再度お申し込みください。",
      data: rejectionReason ? { rejectionReason } : undefined,
    });
  }
}
