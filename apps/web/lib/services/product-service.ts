import { db } from "@/lib/db";
import {
  creatorProfiles,
  creatorStats,
  flavors,
  productImages,
  productTags,
  productVariants,
  products,
  recipeFlavors,
  recipeReviews,
  signatureRecipes,
} from "@kyarainnovate/db/schema";
import type { TagType } from "@kyarainnovate/db/schema";
import type { NoteType } from "@kyarainnovate/db/schema";
import type { Tier } from "@kyarainnovate/db/schema";
import { and, avg, count, eq, isNull, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type ProductVariantDetail = {
  id: string;
  volume: number;
  price: number;
  salePrice: number | null;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  sku: string;
  stock: number;
  effectivePrice: number;
  stockStatus: StockStatus;
};

export type ProductTag = {
  id: string;
  type: TagType;
  value: string;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export type RecipeFlavorInfo = {
  flavorName: string;
  noteType: NoteType;
  ratio: string;
};

export type RecipeInfo = {
  id: string;
  name: string;
  concept: string | null;
  scene: string | null;
  mood: string | null;
};

export type CreatorInfo = {
  displayName: string;
  slug: string;
  tier: Tier;
  avgRating: string;
};

export type ProductDetail = {
  id: string;
  name: string;
  description: string | null;
  priceYen: number;
  imageUrl: string | null;
  blendResultId: string | null;
  recipeId: string | null;
  creatorId: string | null;
  isActive: boolean;
  intensity: string | null;
  giftWrappingAvailable: boolean;
  isLimited: boolean;
  manufacturingDays: number;
  averageRating: string | null;
  reviewCount: number;
  salesCount: number;
  favoriteCount: number;
  aiStory: string | null;
  createdAt: Date;
  updatedAt: Date;
  variants: ProductVariantDetail[];
  tags: ProductTag[];
  images: ProductImage[];
  recipe: RecipeInfo | null;
  recipeFlavors: RecipeFlavorInfo[];
  creator: CreatorInfo | null;
};

// ---------------------------------------------------------------------------
// Helper: effective price considering active sale
// ---------------------------------------------------------------------------

export function getEffectivePrice(variant: {
  price: number;
  salePrice: number | null;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
}): number {
  if (
    variant.salePrice != null &&
    variant.saleStartAt != null &&
    variant.saleEndAt != null
  ) {
    const now = new Date();
    if (now >= variant.saleStartAt && now <= variant.saleEndAt) {
      return variant.salePrice;
    }
  }
  return variant.price;
}

// ---------------------------------------------------------------------------
// Helper: stock status
// ---------------------------------------------------------------------------

function getStockStatus(stock: number): StockStatus {
  if (stock > 10) return "IN_STOCK";
  if (stock >= 1) return "LOW_STOCK";
  return "OUT_OF_STOCK";
}

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------

export async function createProduct(input: {
  name: string;
  description?: string;
  priceYen: number;
  imageUrl?: string;
  recipeId?: string;
  creatorId?: string;
  intensity?: string;
  giftWrappingAvailable?: boolean;
  isLimited?: boolean;
  manufacturingDays?: number;
  aiStory?: string;
  variants?: { volume: number; price: number; sku: string; stock: number }[];
  tags?: { type: string; value: string }[];
  imageUrls?: { url: string; alt?: string }[];
}): Promise<string> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        name: input.name,
        description: input.description,
        priceYen: input.priceYen,
        imageUrl: input.imageUrl,
        recipeId: input.recipeId,
        creatorId: input.creatorId,
        intensity: input.intensity,
        giftWrappingAvailable: input.giftWrappingAvailable ?? false,
        isLimited: input.isLimited ?? false,
        manufacturingDays: input.manufacturingDays ?? 5,
        aiStory: input.aiStory,
      })
      .returning({ id: products.id });

    const productId = product.id;

    // Insert variants
    if (input.variants && input.variants.length > 0) {
      await tx.insert(productVariants).values(
        input.variants.map((v) => ({
          productId,
          volume: v.volume,
          price: v.price,
          sku: v.sku,
          stock: v.stock,
        })),
      );
    }

    // Insert tags
    if (input.tags && input.tags.length > 0) {
      await tx.insert(productTags).values(
        input.tags.map((t) => ({
          productId,
          type: t.type as TagType,
          value: t.value,
        })),
      );
    }

    // Insert images
    if (input.imageUrls && input.imageUrls.length > 0) {
      await tx.insert(productImages).values(
        input.imageUrls.map((img, idx) => ({
          productId,
          url: img.url,
          alt: img.alt ?? null,
          sortOrder: idx,
        })),
      );
    }

    return productId;
  });
}

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------

export async function updateProduct(
  productId: string,
  input: Partial<{
    name: string;
    description: string;
    priceYen: number;
    imageUrl: string;
    intensity: string;
    giftWrappingAvailable: boolean;
    isLimited: boolean;
    manufacturingDays: number;
    aiStory: string;
    isActive: boolean;
  }>,
): Promise<void> {
  await db
    .update(products)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ---------------------------------------------------------------------------
// deleteProduct (soft delete)
// ---------------------------------------------------------------------------

export async function deleteProduct(productId: string): Promise<void> {
  await db
    .update(products)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ---------------------------------------------------------------------------
// getProductDetail
// ---------------------------------------------------------------------------

export async function getProductDetail(
  productId: string,
): Promise<ProductDetail | null> {
  // Fetch base product (exclude soft-deleted)
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)));

  if (!product) return null;

  // Fetch related data in parallel
  const [variantRows, tagRows, imageRows, recipeData, creatorData] =
    await Promise.all([
      // Variants
      db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId)),

      // Tags
      db
        .select({
          id: productTags.id,
          type: productTags.type,
          value: productTags.value,
        })
        .from(productTags)
        .where(eq(productTags.productId, productId)),

      // Images
      db
        .select({
          id: productImages.id,
          url: productImages.url,
          alt: productImages.alt,
          sortOrder: productImages.sortOrder,
        })
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(productImages.sortOrder),

      // Recipe + flavors
      product.recipeId
        ? (async () => {
            const targetRecipeId = product.recipeId as string;
            const [recipe] = await db
              .select({
                id: signatureRecipes.id,
                name: signatureRecipes.name,
                concept: signatureRecipes.concept,
                scene: signatureRecipes.scene,
                mood: signatureRecipes.mood,
              })
              .from(signatureRecipes)
              .where(eq(signatureRecipes.id, targetRecipeId));

            if (!recipe) return { recipe: null, flavors: [] };

            const flavorRows = await db
              .select({
                flavorName: flavors.nameJa,
                noteType: recipeFlavors.noteType,
                ratio: recipeFlavors.ratio,
              })
              .from(recipeFlavors)
              .innerJoin(flavors, eq(recipeFlavors.flavorId, flavors.id))
              .where(eq(recipeFlavors.recipeId, recipe.id));

            return { recipe, flavors: flavorRows };
          })()
        : Promise.resolve({ recipe: null, flavors: [] }),

      // Creator info
      product.creatorId
        ? (async () => {
            const targetCreatorId = product.creatorId as string;
            const [profile] = await db
              .select({
                displayName: creatorProfiles.displayName,
                slug: creatorProfiles.creatorIdSlug,
              })
              .from(creatorProfiles)
              .where(eq(creatorProfiles.userId, targetCreatorId));

            const [stats] = await db
              .select({
                tier: creatorStats.tier,
                avgRating: creatorStats.avgRating,
              })
              .from(creatorStats)
              .where(eq(creatorStats.userId, targetCreatorId));

            if (!profile) return null;

            return {
              displayName: profile.displayName,
              slug: profile.slug,
              tier: (stats?.tier ?? "APPRENTICE") as Tier,
              avgRating: stats?.avgRating ?? "0.00",
            };
          })()
        : Promise.resolve(null),
    ]);

  // Build variant details with effective price and stock status
  const variants: ProductVariantDetail[] = variantRows.map((v) => ({
    id: v.id,
    volume: v.volume,
    price: v.price,
    salePrice: v.salePrice,
    saleStartAt: v.saleStartAt,
    saleEndAt: v.saleEndAt,
    sku: v.sku,
    stock: v.stock,
    effectivePrice: getEffectivePrice(v),
    stockStatus: getStockStatus(v.stock),
  }));

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceYen: product.priceYen,
    imageUrl: product.imageUrl,
    blendResultId: product.blendResultId,
    recipeId: product.recipeId,
    creatorId: product.creatorId,
    isActive: product.isActive,
    intensity: product.intensity,
    giftWrappingAvailable: product.giftWrappingAvailable,
    isLimited: product.isLimited,
    manufacturingDays: product.manufacturingDays,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    salesCount: product.salesCount,
    favoriteCount: product.favoriteCount,
    aiStory: product.aiStory,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants,
    tags: tagRows as ProductTag[],
    images: imageRows,
    recipe: recipeData.recipe as RecipeInfo | null,
    recipeFlavors: recipeData.flavors as RecipeFlavorInfo[],
    creator: creatorData,
  };
}

// ---------------------------------------------------------------------------
// Variant CRUD
// ---------------------------------------------------------------------------

export async function createVariant(
  productId: string,
  input: { volume: number; price: number; sku: string; stock: number },
): Promise<string> {
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId,
      volume: input.volume,
      price: input.price,
      sku: input.sku,
      stock: input.stock,
    })
    .returning({ id: productVariants.id });

  return variant.id;
}

export async function updateVariant(
  variantId: string,
  input: Partial<{
    volume: number;
    price: number;
    sku: string;
    stock: number;
  }>,
): Promise<void> {
  await db
    .update(productVariants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));
}

export async function deleteVariant(variantId: string): Promise<void> {
  await db.delete(productVariants).where(eq(productVariants.id, variantId));
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function setProductTags(
  productId: string,
  tags: { type: string; value: string }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing tags
    await tx.delete(productTags).where(eq(productTags.productId, productId));

    // Insert new tags
    if (tags.length > 0) {
      await tx.insert(productTags).values(
        tags.map((t) => ({
          productId,
          type: t.type as TagType,
          value: t.value,
        })),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function addProductImage(
  productId: string,
  url: string,
  alt?: string,
): Promise<string> {
  // Get current max sortOrder
  const [maxRow] = await db
    .select({
      maxSort: sql<number>`coalesce(max(${productImages.sortOrder}), -1)`,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  const nextSort = (maxRow?.maxSort ?? -1) + 1;

  const [image] = await db
    .insert(productImages)
    .values({
      productId,
      url,
      alt: alt ?? null,
      sortOrder: nextSort,
    })
    .returning({ id: productImages.id });

  return image.id;
}

export async function reorderProductImages(
  productId: string,
  imageIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < imageIds.length; i++) {
      await tx
        .update(productImages)
        .set({ sortOrder: i })
        .where(
          and(
            eq(productImages.id, imageIds[i]),
            eq(productImages.productId, productId),
          ),
        );
    }
  });
}

export async function deleteProductImage(imageId: string): Promise<void> {
  await db.delete(productImages).where(eq(productImages.id, imageId));
}

// ---------------------------------------------------------------------------
// Sale
// ---------------------------------------------------------------------------

export async function setSalePrice(
  variantId: string,
  salePrice: number,
  startAt: Date,
  endAt: Date,
): Promise<void> {
  await db
    .update(productVariants)
    .set({
      salePrice,
      saleStartAt: startAt,
      saleEndAt: endAt,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));
}

export async function clearSalePrice(variantId: string): Promise<void> {
  await db
    .update(productVariants)
    .set({
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));
}

// ---------------------------------------------------------------------------
// Stats update
// ---------------------------------------------------------------------------

export async function incrementSalesCount(
  productId: string,
  quantity: number,
): Promise<void> {
  await db
    .update(products)
    .set({
      salesCount: sql`${products.salesCount} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

export async function updateProductRating(productId: string): Promise<void> {
  // Get recipeId linked to this product
  const [product] = await db
    .select({ recipeId: products.recipeId })
    .from(products)
    .where(eq(products.id, productId));

  if (!product?.recipeId) return;

  // Calculate average rating and count from recipe reviews
  const [stats] = await db
    .select({
      avgRating: avg(recipeReviews.rating),
      reviewCount: count(),
    })
    .from(recipeReviews)
    .where(eq(recipeReviews.recipeId, product.recipeId));

  await db
    .update(products)
    .set({
      averageRating: stats?.avgRating ?? "0.00",
      reviewCount: stats?.reviewCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

export async function updateFavoriteCount(
  productId: string,
  delta: number,
): Promise<void> {
  await db
    .update(products)
    .set({
      favoriteCount: sql`greatest(${products.favoriteCount} + ${delta}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}
