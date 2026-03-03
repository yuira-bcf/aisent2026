import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { getDashboardStats } from "@/lib/services/admin-service";

/**
 * GET /api/v1/admin/dashboard
 *
 * Admin only. Get dashboard statistics.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const stats = await getDashboardStats();

  return apiSuccess(stats);
});
