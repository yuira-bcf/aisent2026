import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { NOT_FOUND, VALIDATION_ERROR, apiSuccess } from "@/lib/api/response";
import {
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/services/cart-service";
import type { NextRequest } from "next/server";
import { z } from "zod";

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

/**
 * PATCH /api/v1/cart/items/:id
 *
 * Update cart item quantity.
 */
export const PATCH = safeHandler(async (req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateQuantitySchema.safeParse(body);

  if (!parsed.success) {
    return VALIDATION_ERROR(parsed.error.errors[0].message);
  }

  const updated = await updateCartItemQuantity(
    authResult.userId,
    id,
    parsed.data.quantity,
  );

  if (!updated) return NOT_FOUND("カートアイテムが見つかりません");

  const cart = await getCart(authResult.userId);
  return apiSuccess({ cart });
});

/**
 * DELETE /api/v1/cart/items/:id
 *
 * Remove cart item.
 */
export const DELETE = safeHandler(async (_req: NextRequest, ctx) => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const { id } = await ctx.params;

  const removed = await removeCartItem(authResult.userId, id);

  if (!removed) return NOT_FOUND("カートアイテムが見つかりません");

  const cart = await getCart(authResult.userId);
  return apiSuccess({ cart });
});
