import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { paginationMeta, parsePagination } from "@/lib/api/pagination";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { createOrder, getOrdersForUser } from "@/lib/services/order-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * GET /api/v1/orders
 *
 * List orders for the authenticated user (paginated).
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { page, limit } = parsePagination(req);
  const { items, total } = await getOrdersForUser(
    authResult.userId,
    page,
    limit,
  );

  return apiSuccess({
    orders: items,
    pagination: paginationMeta(total, page, limit),
  });
});

const createOrderSchema = z.object({
  shippingAddressId: z.string().uuid(),
});

/**
 * POST /api/v1/orders
 *
 * Create a new order from the current cart.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const result = await createOrder(
    authResult.userId,
    parsed.data.shippingAddressId,
  );

  if (!result.success) {
    return VALIDATION_ERROR(result.error);
  }

  return apiSuccess(
    { orderId: result.orderId, stripeSessionUrl: result.stripeSessionUrl },
    201,
  );
});
