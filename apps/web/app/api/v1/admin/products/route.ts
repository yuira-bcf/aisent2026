import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/products
 *
 * Admin only. List all products.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const items = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));

  return apiSuccess({ products: items });
});

/**
 * POST /api/v1/admin/products
 *
 * Admin only. Create a new product.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const { name, description, priceYen, isActive, recipeId } = body as {
    name?: string;
    description?: string;
    priceYen?: number;
    isActive?: boolean;
    recipeId?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return VALIDATION_ERROR("商品名を入力してください");
  }

  if (priceYen === undefined || typeof priceYen !== "number" || priceYen < 0) {
    return VALIDATION_ERROR("価格を正しく入力してください");
  }

  const [product] = await db
    .insert(products)
    .values({
      name: name.trim(),
      description: description || null,
      priceYen,
      isActive: isActive ?? true,
      recipeId: recipeId || null,
    })
    .returning();

  return apiSuccess({ product }, 201);
});
