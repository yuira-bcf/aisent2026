import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import {
  deleteNotification,
  markAsRead,
} from "@/lib/services/notification-service";
import type { NextRequest } from "next/server";

/**
 * PUT /api/v1/notifications/:id
 *
 * Mark a single notification as read (owner only).
 */
export const PUT = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const ok = await markAsRead(authResult.userId, id);

  if (!ok) return NOT_FOUND("通知が見つかりません");

  return apiSuccess({ read: true });
});

/**
 * DELETE /api/v1/notifications/:id
 *
 * Delete a notification (owner only).
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const ok = await deleteNotification(authResult.userId, id);

  if (!ok) return NOT_FOUND("通知が見つかりません");

  return apiSuccess({ deleted: true });
});
