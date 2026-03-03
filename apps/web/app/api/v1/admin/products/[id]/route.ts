import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * PUT /api/v1/admin/products/:id
 *
 * Admin only. Update a product.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, id));

  if (!existing) return NOT_FOUND("商品が見つかりません");

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.priceYen !== undefined) updates.priceYen = body.priceYen;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  const [product] = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, id))
    .returning();

  return apiSuccess({ product });
});

/**
 * DELETE /api/v1/admin/products/:id
 *
 * Admin only. Delete a product.
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, id));

  if (!existing) return NOT_FOUND("商品が見つかりません");

  await db.delete(products).where(eq(products.id, id));

  return apiSuccess({ deleted: true });
});
