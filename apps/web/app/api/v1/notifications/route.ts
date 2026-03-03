import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getNotificationsForUser } from "@/lib/services/notification-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/notifications
 *
 * List notifications for the authenticated user (paginated).
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total, unreadCount } = await getNotificationsForUser(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    items,
    unreadCount,
    pagination: paginationMeta(total, page, limit),
  });
});
