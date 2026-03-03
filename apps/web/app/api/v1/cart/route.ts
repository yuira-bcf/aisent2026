import { requireAuth } from "@/lib/api/auth-guard";
import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { getCart } from "@/lib/services/cart-service";

/**
 * GET /api/v1/cart
 *
 * Get cart for the authenticated user.
 */
export const GET = safeHandler(async () => {
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  const cart = await getCart(authResult.userId);

  return apiSuccess({ cart });
});
