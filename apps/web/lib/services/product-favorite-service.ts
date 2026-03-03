import { db } from "@/lib/db";
import { productFavorites, products } from "@kyarainnovate/db/schema";
import { and, count, desc, eq } from "drizzle-orm";

export async function toggleProductFavorite(
  userId: string,
  productId: string,
): Promise<{ favorited: boolean }> {
  const [existing] = await db
    .select()
    .from(productFavorites)
    .where(
      and(
        eq(productFavorites.userId, userId),
        eq(productFavorites.productId, productId),
      ),
    );

  if (existing) {
    await db
      .delete(productFavorites)
      .where(eq(productFavorites.id, existing.id));
    return { favorited: false };
  }

  await db.insert(productFavorites).values({ userId, productId });
  return { favorited: true };
}

export async function getProductFavorites(
  userId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        favoriteId: productFavorites.id,
        favoritedAt: productFavorites.createdAt,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          priceYen: products.priceYen,
          imageUrl: products.imageUrl,
          isActive: products.isActive,
        },
      })
      .from(productFavorites)
      .innerJoin(products, eq(productFavorites.productId, products.id))
      .where(eq(productFavorites.userId, userId))
      .orderBy(desc(productFavorites.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(productFavorites)
      .where(eq(productFavorites.userId, userId)),
  ]);

  return { items, total };
}

export async function isProductFavorited(
  userId: string,
  productId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: productFavorites.id })
    .from(productFavorites)
    .where(
      and(
        eq(productFavorites.userId, userId),
        eq(productFavorites.productId, productId),
      ),
    );

  return !!existing;
}

export async function getUserFavoritedProductIds(
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ productId: productFavorites.productId })
    .from(productFavorites)
    .where(eq(productFavorites.userId, userId));

  return new Set(rows.map((r) => r.productId));
}
