import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { getCreatorStats } from "@/lib/services/creator-service";

/**
 * GET /api/v1/creator/stats
 *
 * Get statistics for the authenticated creator.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const stats = await getCreatorStats(authResult.userId);

  return apiSuccess(stats);
});
