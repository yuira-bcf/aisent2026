import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getBlendResults } from "@/lib/services/blend-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/blend/results
 *
 * Paginated blend results for the authenticated user.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total } = await getBlendResults(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    items,
    pagination: paginationMeta(total, page, limit),
  });
});
