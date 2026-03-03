import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, apiSuccess } from "@/lib/api/response";
import { getOrderDetail } from "@/lib/services/order-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/orders/:id
 *
 * Get order detail (owner only).
 */
export const GET = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const order = await getOrderDetail(id, authResult.userId);

  if (!order) return NOT_FOUND("注文が見つかりません");

  return apiSuccess({ order });
});
