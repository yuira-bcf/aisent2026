import { db } from "@/lib/db";
import {
  CANCELLABLE_STATUSES,
  validateStatusTransition,
} from "@/lib/order/status-transitions";
import {
  applyCoupon as applyCouponUsage,
  validateCoupon,
} from "@/lib/services/coupon-service";
import {
  notifyCreatorNewOrder,
  notifyOrderStatusChange,
} from "@/lib/services/notification-service";
import { calculateRoyalty } from "@/lib/services/royalty-service";
import { stripe } from "@/lib/stripe";
import {
  cartItems,
  orderItems,
  orders,
  productVariants,
  products,
  shippingAddresses,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import type { OrderStatus } from "@kyarainnovate/db/schema";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateOrderResult =
  | { success: true; orderId: string; stripeSessionUrl: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helper – resolve effective variant price considering sale period
// ---------------------------------------------------------------------------

function resolveVariantPrice(row: {
  variantPrice: number | null;
  variantSalePrice: number | null;
  variantSaleStartAt: Date | null;
  variantSaleEndAt: Date | null;
  productPriceYen: number;
}): number {
  if (row.variantPrice == null) return row.productPriceYen;

  const now = new Date();
  if (
    row.variantSalePrice != null &&
    row.variantSaleStartAt != null &&
    row.variantSaleEndAt != null &&
    row.variantSaleStartAt <= now &&
    now <= row.variantSaleEndAt
  ) {
    return row.variantSalePrice;
  }
  return row.variantPrice;
}

// ---------------------------------------------------------------------------
// createOrder – Build an order from the user's cart & start Stripe Checkout
// ---------------------------------------------------------------------------

export async function createOrder(
  userId: string,
  shippingAddressId: string,
  couponCode?: string,
): Promise<CreateOrderResult> {
  // 1. Verify the shipping address belongs to the user
  const [address] = await db
    .select()
    .from(shippingAddresses)
    .where(
      and(
        eq(shippingAddresses.id, shippingAddressId),
        eq(shippingAddresses.userId, userId),
      ),
    );

  if (!address) {
    return { success: false, error: "配送先住所が見つかりません" };
  }

  // 2. Get cart items with product + variant details (only active products)
  const cartRows = await db
    .select({
      cartItemId: cartItems.id,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      productName: products.name,
      productPriceYen: products.priceYen,
      variantPrice: productVariants.price,
      variantSalePrice: productVariants.salePrice,
      variantSaleStartAt: productVariants.saleStartAt,
      variantSaleEndAt: productVariants.saleEndAt,
      volume: productVariants.volume,
      sku: productVariants.sku,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(and(eq(cartItems.userId, userId), eq(products.isActive, true)));

  // 3. Validate cart is not empty
  if (cartRows.length === 0) {
    return { success: false, error: "カートが空です" };
  }

  // 4. Build items with resolved prices
  const items = cartRows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    priceYen: resolveVariantPrice(row),
    quantity: row.quantity,
    variantId: row.variantId,
    volume: row.volume,
    sku: row.sku,
  }));

  const subtotalYen = items.reduce(
    (sum, item) => sum + item.priceYen * item.quantity,
    0,
  );

  // 4b. Validate coupon if provided
  let couponResult: { couponId: string; discountYen: number } | null = null;
  if (couponCode) {
    const validation = await validateCoupon(couponCode, userId, subtotalYen);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    couponResult = {
      couponId: validation.couponId,
      discountYen: validation.discountYen,
    };
  }

  const discountYen = couponResult?.discountYen ?? 0;
  const totalYen = subtotalYen - discountYen;

  // 5. Create order + items + clear cart in a single transaction
  const order = await db.transaction(async (tx) => {
    const [ord] = await tx
      .insert(orders)
      .values({
        userId,
        status: "PENDING",
        totalYen,
        discountYen,
        shippingRecipientName: address.recipientName,
        shippingPostalCode: address.postalCode,
        shippingPrefecture: address.prefecture,
        shippingCity: address.city,
        shippingAddressLine1: address.addressLine1,
        shippingAddressLine2: address.addressLine2,
        shippingPhone: address.phone,
      })
      .returning();

    await tx.insert(orderItems).values(
      items.map((item) => ({
        orderId: ord.id,
        productId: item.productId,
        productName: item.productName,
        priceYen: item.priceYen,
        quantity: item.quantity,
        variantId: item.variantId,
        volume: item.volume,
        sku: item.sku,
      })),
    );

    await tx.delete(cartItems).where(eq(cartItems.userId, userId));

    return ord;
  });

  // 6. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: items.map((item) => ({
      price_data: {
        currency: "jpy",
        product_data: {
          name: item.volume
            ? `${item.productName} (${item.volume}ml)`
            : item.productName,
        },
        unit_amount: item.priceYen,
      },
      quantity: item.quantity,
    })),
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${order.id}?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart?cancelled=true`,
    metadata: { orderId: order.id },
  });

  // 7. Update order with stripeSessionId
  await db
    .update(orders)
    .set({ stripeSessionId: session.id })
    .where(eq(orders.id, order.id));

  // 8. Apply coupon usage if applicable
  if (couponResult) {
    await applyCouponUsage(
      couponResult.couponId,
      userId,
      order.id,
      couponResult.discountYen,
    );
  }

  // 9. Return result
  return {
    success: true,
    orderId: order.id,
    stripeSessionUrl: session.url ?? "",
  };
}

// ---------------------------------------------------------------------------
// handleStripeWebhook – Verify & process Stripe webhook events
// ---------------------------------------------------------------------------

export async function handleStripeWebhook(
  payload: string,
  signature: string,
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET ?? "",
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) break;

      const [confirmedOrder] = await db
        .update(orders)
        .set({
          status: "CONFIRMED",
          updatedAt: new Date(),
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
        })
        .where(eq(orders.id, orderId))
        .returning({ userId: orders.userId });

      if (confirmedOrder) {
        // Decrement variant stock for items with variantId
        const variantItems = await db
          .select({
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, orderId),
              isNotNull(orderItems.variantId),
            ),
          );

        for (const vi of variantItems) {
          if (vi.variantId) {
            await db
              .update(productVariants)
              .set({
                stock: sql`${productVariants.stock} - ${vi.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, vi.variantId));
          }
        }

        notifyOrderStatusChange(
          confirmedOrder.userId,
          orderId,
          "CONFIRMED",
        ).catch((err) =>
          console.error("[order-service] notification failed:", err),
        );
        calculateRoyalty(orderId).catch((err) =>
          console.error("[order-service] royalty calculation failed:", err),
        );

        // Notify creators whose recipes are included in this order
        db.select({
          creatorId: signatureRecipes.creatorId,
          recipeName: signatureRecipes.name,
        })
          .from(orderItems)
          .innerJoin(products, eq(orderItems.productId, products.id))
          .innerJoin(
            signatureRecipes,
            eq(products.recipeId, signatureRecipes.id),
          )
          .where(eq(orderItems.orderId, orderId))
          .then((rows) => {
            const seen = new Set<string>();
            for (const row of rows) {
              const key = `${row.creatorId}:${row.recipeName}`;
              if (seen.has(key)) continue;
              seen.add(key);
              notifyCreatorNewOrder(
                row.creatorId,
                orderId,
                row.recipeName,
              ).catch((err) =>
                console.error(
                  "[order-service] creator notification failed:",
                  err,
                ),
              );
            }
          })
          .catch((err) =>
            console.error("[order-service] creator order query failed:", err),
          );
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) break;

      const [cancelledOrder] = await db
        .update(orders)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning({ userId: orders.userId });

      if (cancelledOrder) {
        notifyOrderStatusChange(
          cancelledOrder.userId,
          orderId,
          "CANCELLED",
        ).catch((err) =>
          console.error("[order-service] notification failed:", err),
        );
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// getOrdersForUser – Paginated list of orders for a user
// ---------------------------------------------------------------------------

export async function getOrdersForUser(
  userId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [items, [{ value: total }]] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: { items: true },
      orderBy: desc(orders.createdAt),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(orders).where(eq(orders.userId, userId)),
  ]);

  return { items, total };
}

// ---------------------------------------------------------------------------
// getOrderDetail – Single order with items (ownership check)
// ---------------------------------------------------------------------------

export async function getOrderDetail(orderId: string, userId: string) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
    with: { items: true },
  });

  return order ?? null;
}

// ---------------------------------------------------------------------------
// updateOrderStatus – Admin-only status update
// ---------------------------------------------------------------------------

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
): Promise<boolean> {
  const [existing] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId));

  if (!existing) return false;

  validateStatusTransition(existing.status, newStatus);

  const result = await db
    .update(orders)
    .set({
      status: newStatus,
      updatedAt: new Date(),
      ...(newStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
    })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id, userId: orders.userId });

  if (result.length > 0) {
    notifyOrderStatusChange(result[0].userId, orderId, newStatus).catch((err) =>
      console.error("[order-service] notification failed:", err),
    );
  }

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// cancelOrder – User-initiated order cancellation
// ---------------------------------------------------------------------------

export async function cancelOrder(
  orderId: string,
  userId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));

  if (!order) return { success: false, error: "注文が見つかりません" };

  if (!CANCELLABLE_STATUSES.includes(order.status as OrderStatus)) {
    return { success: false, error: "この注文はキャンセルできません" };
  }

  // Restore variant stock for items with variantId
  const variantItems = await db
    .select({
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(
      and(eq(orderItems.orderId, orderId), isNotNull(orderItems.variantId)),
    );

  await db.transaction(async (tx) => {
    // Restore stock
    for (const vi of variantItems) {
      if (vi.variantId) {
        await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} + ${vi.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, vi.variantId));
      }
    }

    // Update order status
    await tx
      .update(orders)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        updatedAt: new Date(),
        cancelReason: reason ?? "USER_CANCEL",
      })
      .where(eq(orders.id, orderId));
  });

  return { success: true };
}
