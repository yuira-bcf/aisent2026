import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { getUnreadCount } from "@/lib/services/notification-service";

/**
 * GET /api/v1/notifications/unread-count
 *
 * Get the unread notification count for the authenticated user.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const unreadCount = await getUnreadCount(authResult.userId);

  return apiSuccess({ unreadCount });
});
