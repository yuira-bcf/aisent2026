import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { markAsRead } from "@/lib/services/notification-service";
import type { NextRequest } from "next/server";

/**
 * PATCH /api/v1/notifications/:id/read
 *
 * Mark a single notification as read.
 */
export const PATCH = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const ok = await markAsRead(authResult.userId, id);

  if (!ok) return NOT_FOUND("通知が見つかりません");

  return apiSuccess({ success: true });
});
