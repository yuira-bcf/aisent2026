import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/shop/products/:id
 *
 * Get single product detail (public).
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.isActive, true)));

  if (!product) return NOT_FOUND("商品が見つかりません");

  return apiSuccess({ product });
});
