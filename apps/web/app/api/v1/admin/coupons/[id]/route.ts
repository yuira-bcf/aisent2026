import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { coupons } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * PUT /api/v1/admin/coupons/:id
 *
 * Admin only. Update a coupon.
 */
export const PUT = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();

  const [existing] = await db.select().from(coupons).where(eq(coupons.id, id));

  if (!existing) return NOT_FOUND("クーポンが見つかりません");

  const updates: Record<string, unknown> = {};

  if (body.code !== undefined) updates.code = String(body.code).toUpperCase();
  if (body.discountType !== undefined) {
    if (!["FIXED", "PERCENT"].includes(body.discountType)) {
      return VALIDATION_ERROR("割引タイプが不正です");
    }
    updates.discountType = body.discountType;
  }
  if (body.discountValue !== undefined)
    updates.discountValue = body.discountValue;
  if (body.minOrderYen !== undefined) updates.minOrderYen = body.minOrderYen;
  if (body.maxUses !== undefined) updates.maxUses = body.maxUses;
  if (body.validFrom !== undefined)
    updates.validFrom = new Date(body.validFrom);
  if (body.validUntil !== undefined)
    updates.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  const [coupon] = await db
    .update(coupons)
    .set(updates)
    .where(eq(coupons.id, id))
    .returning();

  return apiSuccess({ coupon });
});

/**
 * DELETE /api/v1/admin/coupons/:id
 *
 * Admin only. Deactivate a coupon (soft delete).
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;

  const [existing] = await db.select().from(coupons).where(eq(coupons.id, id));

  if (!existing) return NOT_FOUND("クーポンが見つかりません");

  const [coupon] = await db
    .update(coupons)
    .set({ isActive: false })
    .where(eq(coupons.id, id))
    .returning();

  return apiSuccess({ coupon });
});
