import { db } from "@/lib/db";
import { couponUsages, coupons } from "@kyarainnovate/db/schema";
import { and, eq, sql } from "drizzle-orm";

type ValidateResult =
  | { valid: true; couponId: string; discountYen: number }
  | { valid: false; reason: string };

export async function validateCoupon(
  code: string,
  userId: string,
  orderTotalYen: number,
): Promise<ValidateResult> {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(
      and(eq(coupons.code, code.toUpperCase()), eq(coupons.isActive, true)),
    );

  if (!coupon) {
    return { valid: false, reason: "クーポンが見つかりません" };
  }

  const now = new Date();

  if (now < coupon.validFrom) {
    return { valid: false, reason: "このクーポンはまだ有効ではありません" };
  }

  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, reason: "このクーポンは有効期限が切れています" };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: "このクーポンは利用上限に達しました" };
  }

  if (orderTotalYen < coupon.minOrderYen) {
    return {
      valid: false,
      reason: `このクーポンは¥${coupon.minOrderYen.toLocaleString()}以上の注文で利用できます`,
    };
  }

  // Calculate discount
  let discountYen: number;
  if (coupon.discountType === "FIXED") {
    discountYen = coupon.discountValue;
  } else {
    discountYen = Math.floor(orderTotalYen * (coupon.discountValue / 100));
  }

  // Discount cannot exceed order total
  discountYen = Math.min(discountYen, orderTotalYen);

  return { valid: true, couponId: coupon.id, discountYen };
}

export async function applyCoupon(
  couponId: string,
  userId: string,
  orderId: string,
  discountYen: number,
): Promise<void> {
  await db.insert(couponUsages).values({
    couponId,
    userId,
    orderId,
    discountYen,
  });

  await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, couponId));
}
