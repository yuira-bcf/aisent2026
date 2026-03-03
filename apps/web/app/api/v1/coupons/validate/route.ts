import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { validateCoupon } from "@/lib/services/coupon-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/coupons/validate
 *
 * Validate a coupon code for the current user's order total.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const { code, orderTotalYen } = body as {
    code?: string;
    orderTotalYen?: number;
  };

  if (!code || typeof code !== "string") {
    return VALIDATION_ERROR("クーポンコードを入力してください");
  }

  if (
    !orderTotalYen ||
    typeof orderTotalYen !== "number" ||
    orderTotalYen <= 0
  ) {
    return VALIDATION_ERROR("注文金額が不正です");
  }

  const result = await validateCoupon(code, authResult.userId, orderTotalYen);

  if (!result.valid) {
    return VALIDATION_ERROR(result.reason);
  }

  return apiSuccess({
    couponId: result.couponId,
    discountYen: result.discountYen,
    code: code.toUpperCase(),
  });
});
