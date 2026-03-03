import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { coupons } from "@kyarainnovate/db/schema";
import type { DiscountType } from "@kyarainnovate/db/schema";
import { count, desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/admin/coupons
 *
 * Admin only. List all coupons.
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { page, limit, offset } = parsePagination(req);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(coupons)
      .orderBy(desc(coupons.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(coupons),
  ]);

  return apiSuccess({
    coupons: items,
    pagination: paginationMeta(total, page, limit),
  });
});

/**
 * POST /api/v1/admin/coupons
 *
 * Admin only. Create a new coupon.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const {
    code,
    discountType,
    discountValue,
    minOrderYen,
    maxUses,
    validFrom,
    validUntil,
  } = body as {
    code?: string;
    discountType?: DiscountType;
    discountValue?: number;
    minOrderYen?: number;
    maxUses?: number | null;
    validFrom?: string;
    validUntil?: string | null;
  };

  if (!code || typeof code !== "string") {
    return VALIDATION_ERROR("クーポンコードを入力してください");
  }

  if (!discountType || !["FIXED", "PERCENT"].includes(discountType)) {
    return VALIDATION_ERROR("割引タイプが不正です");
  }

  if (
    !discountValue ||
    typeof discountValue !== "number" ||
    discountValue <= 0
  ) {
    return VALIDATION_ERROR("割引額を入力してください");
  }

  if (discountType === "PERCENT" && discountValue > 100) {
    return VALIDATION_ERROR("割引率は100%以下にしてください");
  }

  const [coupon] = await db
    .insert(coupons)
    .values({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderYen: minOrderYen ?? 0,
      maxUses: maxUses ?? null,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
    })
    .returning();

  return apiSuccess({ coupon }, 201);
});
