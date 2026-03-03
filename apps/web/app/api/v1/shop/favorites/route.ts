import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { apiSuccess } from "@/lib/api/response";
import { getProductFavorites } from "@/lib/services/product-favorite-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/shop/favorites
 *
 * Get user's favorited products. Auth required.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total } = await getProductFavorites(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    favorites: items,
    pagination: paginationMeta(total, page, limit),
  });
});
