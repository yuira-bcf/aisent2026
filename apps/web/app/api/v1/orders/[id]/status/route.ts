import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { updateOrderStatus } from "@/lib/services/order-service";
import { orderStatusEnum } from "@kyarainnovate/db/schema";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(orderStatusEnum),
});

/**
 * PATCH /api/v1/orders/:id/status
 *
 * Update order status (ADMIN only).
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth(["ADMIN"]);
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateStatusSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateOrderStatus(id, parsed.data.status);

  if (!updated) return NOT_FOUND("注文が見つかりません");

  return apiSuccess({ orderId: id, status: parsed.data.status });
});
