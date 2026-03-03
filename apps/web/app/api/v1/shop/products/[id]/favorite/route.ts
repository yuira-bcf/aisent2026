import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { toggleProductFavorite } from "@/lib/services/product-favorite-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/shop/products/:id/favorite
 *
 * Toggle favorite status for a product. Auth required.
 */
export const POST = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const result = await toggleProductFavorite(authResult.userId, id);

  return apiSuccess(result);
});
