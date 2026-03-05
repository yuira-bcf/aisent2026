import { db } from "@/lib/db";
import { productVariants } from "@kyarainnovate/db/schema";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

// ---------------------------------------------------------------------------
// getStockStatus
// ---------------------------------------------------------------------------

export function getStockStatus(stock: number): StockStatus {
  if (stock > 10) return "IN_STOCK";
  if (stock >= 1) return "LOW_STOCK";
  return "OUT_OF_STOCK";
}

// ---------------------------------------------------------------------------
// checkStock
// ---------------------------------------------------------------------------

export async function checkStock(
  variantId: string,
  quantity: number,
): Promise<{ available: boolean; currentStock: number }> {
  const [variant] = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId));

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  return {
    available: variant.stock >= quantity,
    currentStock: variant.stock,
  };
}

// ---------------------------------------------------------------------------
// decrementStock
// ---------------------------------------------------------------------------

export async function decrementStock(
  variantId: string,
  quantity: number,
): Promise<void> {
  const [variant] = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId));

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  if (variant.stock < quantity) {
    throw new Error(
      `Insufficient stock for variant ${variantId}: requested ${quantity}, available ${variant.stock}`,
    );
  }

  await db
    .update(productVariants)
    .set({
      stock: sql`${productVariants.stock} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));
}

// ---------------------------------------------------------------------------
// restoreStock – For order cancellation
// ---------------------------------------------------------------------------

export async function restoreStock(
  variantId: string,
  quantity: number,
): Promise<void> {
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.id, variantId));

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  await db
    .update(productVariants)
    .set({
      stock: sql`${productVariants.stock} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));
}

// ---------------------------------------------------------------------------
// setStock – Admin direct set
// ---------------------------------------------------------------------------

export async function setStock(
  variantId: string,
  newStock: number,
): Promise<void> {
  await db
    .update(productVariants)
    .set({
      stock: newStock,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));
}
