import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { cancelOrder } from "@/lib/services/order-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/orders/:id/cancel
 *
 * Cancel an order. Auth required (owner only).
 */
export const POST = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = (body as { reason?: string }).reason;

  const result = await cancelOrder(id, authResult.userId, reason);

  if (!result.success) {
    return VALIDATION_ERROR(result.error ?? "不明なエラー");
  }

  return apiSuccess({ cancelled: true });
});
