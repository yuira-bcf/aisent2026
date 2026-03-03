import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/v1/shop/products
 *
 * List all active products (public).
 */
export const GET = safeHandler(async () => {
  const results = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt));

  return apiSuccess({ products: results });
});
