import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { getProductDetail } from "@/lib/services/product-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/shop/products/:id
 *
 * Get single product detail (public).
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;

  const product = await getProductDetail(id);
  if (!product) return NOT_FOUND("商品が見つかりません");

  return apiSuccess({ product });
});
