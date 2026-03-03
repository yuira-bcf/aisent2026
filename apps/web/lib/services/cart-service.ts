import { db } from "@/lib/db";
import { cartItems, products } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  priceYen: number;
  imageUrl: string | null;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
  totalYen: number;
};

// ---------------------------------------------------------------------------
// getCart – Get cart with items and product details
// ---------------------------------------------------------------------------

export async function getCart(userId: string): Promise<Cart> {
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      name: products.name,
      priceYen: products.priceYen,
      imageUrl: products.imageUrl,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(and(eq(cartItems.userId, userId), eq(products.isActive, true)));

  const totalYen = rows.reduce(
    (sum, item) => sum + item.priceYen * item.quantity,
    0,
  );

  return { items: rows, totalYen };
}

// ---------------------------------------------------------------------------
// addToCart – Add item to cart (upsert quantity)
// ---------------------------------------------------------------------------

export async function addToCart(
  userId: string,
  productId: string,
  quantity = 1,
): Promise<Cart> {
  const existing = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.userId, userId),
      eq(cartItems.productId, productId),
    ),
  });

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      userId,
      productId,
      quantity,
    });
  }

  return getCart(userId);
}

// ---------------------------------------------------------------------------
// updateCartItemQuantity – Update quantity (delete if <= 0)
// ---------------------------------------------------------------------------

export async function updateCartItemQuantity(
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<boolean> {
  if (quantity <= 0) {
    return removeCartItem(userId, cartItemId);
  }

  const result = await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
    .returning({ id: cartItems.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// removeCartItem – Remove a single item from cart
// ---------------------------------------------------------------------------

export async function removeCartItem(
  userId: string,
  cartItemId: string,
): Promise<boolean> {
  const result = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
    .returning({ id: cartItems.id });

  return result.length > 0;
}

// ---------------------------------------------------------------------------
// clearCart – Remove all cart items for a user
// ---------------------------------------------------------------------------

export async function clearCart(userId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}
