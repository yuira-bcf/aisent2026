import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateNotificationPreferencesSchema,
} from "@/lib/services/notification-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/notifications/preferences
 *
 * Get notification preferences for the authenticated user.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const preferences = await getNotificationPreferences(authResult.userId);

  return apiSuccess({ preferences });
});

/**
 * PUT /api/v1/notifications/preferences
 *
 * Update notification preferences for the authenticated user.
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = updateNotificationPreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const preferences = await updateNotificationPreferences(
    authResult.userId,
    parsed.data,
  );

  return apiSuccess({ preferences });
});
