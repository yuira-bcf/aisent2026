import {
  INTERNAL_ERROR,
  VALIDATION_ERROR,
  apiSuccess,
} from "@/lib/api/response";
import { handleStripeWebhook } from "@/lib/services/order-service";
import type { NextRequest } from "next/server";

/**
 * POST /api/v1/orders/webhook
 *
 * Stripe webhook endpoint.
 * NOTE: This route intentionally does NOT use safeHandler because it needs
 * raw body access for Stripe signature verification.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return VALIDATION_ERROR("Missing stripe-signature header");
  }

  try {
    await handleStripeWebhook(payload, signature);
    return apiSuccess({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook Error]", error);
    return INTERNAL_ERROR("Webhook processing failed");
  }
}
