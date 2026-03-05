import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import { addToCart } from "@/lib/services/cart-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).optional().default(1),
  variantId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/cart/items
 *
 * Add item to cart.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const body = await req.json();
  const parsed = addItemSchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const cart = await addToCart(
    authResult.userId,
    parsed.data.productId,
    parsed.data.quantity,
    parsed.data.variantId,
  );

  return apiSuccess({ cart });
});
