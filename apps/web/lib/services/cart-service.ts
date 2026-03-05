import { db } from "@/lib/db";
import { cartItems, productVariants, products } from "@kyarainnovate/db/schema";
import { and, eq, sql } from "drizzle-orm";

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
  variantId: string | null;
  volume: number | null;
  sku: string | null;
  stock: number | null;
};

export type Cart = {
  items: CartItem[];
  totalYen: number;
};

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
// getCart – Get cart with items and product details
// ---------------------------------------------------------------------------

export async function getCart(userId: string): Promise<Cart> {
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      name: products.name,
      productPriceYen: products.priceYen,
      imageUrl: products.imageUrl,
      quantity: cartItems.quantity,
      variantPrice: productVariants.price,
      variantSalePrice: productVariants.salePrice,
      variantSaleStartAt: productVariants.saleStartAt,
      variantSaleEndAt: productVariants.saleEndAt,
      volume: productVariants.volume,
      sku: productVariants.sku,
      stock: productVariants.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(and(eq(cartItems.userId, userId), eq(products.isActive, true)));

  const items: CartItem[] = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    name: row.name,
    priceYen: resolveVariantPrice(row),
    imageUrl: row.imageUrl,
    quantity: row.quantity,
    variantId: row.variantId,
    volume: row.volume,
    sku: row.sku,
    stock: row.stock,
  }));

  const totalYen = items.reduce(
    (sum, item) => sum + item.priceYen * item.quantity,
    0,
  );

  return { items, totalYen };
}

// ---------------------------------------------------------------------------
// addToCart – Add item to cart (upsert quantity)
// ---------------------------------------------------------------------------

export async function addToCart(
  userId: string,
  productId: string,
  quantity = 1,
  variantId?: string,
): Promise<Cart> {
  // Build the condition for upsert lookup
  const conditions = [
    eq(cartItems.userId, userId),
    eq(cartItems.productId, productId),
  ];

  if (variantId) {
    conditions.push(eq(cartItems.variantId, variantId));
  } else {
    conditions.push(sql`${cartItems.variantId} IS NULL`);
  }

  const existing = await db.query.cartItems.findFirst({
    where: and(...conditions),
  });

  const newQuantity = existing ? existing.quantity + quantity : quantity;

  // Stock check when variantId is specified
  if (variantId) {
    const [variant] = await db
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, variantId));

    if (!variant) {
      throw new Error("指定されたバリアントが見つかりません");
    }

    if (variant.stock < newQuantity) {
      throw new Error("在庫が不足しています");
    }
  }

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: newQuantity })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      userId,
      productId,
      variantId: variantId ?? null,
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
