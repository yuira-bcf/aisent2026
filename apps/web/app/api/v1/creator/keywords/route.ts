import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { getKeywordsWithRuleCounts } from "@/lib/services/creator-service";

/**
 * GET /api/v1/creator/keywords
 *
 * Get all keywords with rule counts for the authenticated creator.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["CREATOR", "ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const data = await getKeywordsWithRuleCounts(authResult.userId);

  return apiSuccess({ keywords: data });
});
