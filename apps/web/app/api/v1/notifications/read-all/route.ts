import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { markAllAsRead } from "@/lib/services/notification-service";

/**
 * PATCH /api/v1/notifications/read-all
 *
 * Mark all notifications as read for the authenticated user.
 */
export const PATCH = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { count } = await markAllAsRead(authResult.userId);

  return apiSuccess({ count });
});
