import { db } from "@/lib/db";
import {
  productTags,
  productVariants,
  products,
} from "@kyarainnovate/db/schema";
import type { TagType } from "@kyarainnovate/db/schema";
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortOption =
  | "newest"
  | "popular"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "reviews"
  | "sales"
  | "favorites";

export type SearchParams = {
  q?: string;
  creatorId?: string;
  priceMin?: number;
  priceMax?: number;
  volume?: number;
  season?: string;
  scene?: string;
  feature?: string;
  minRating?: number;
  intensity?: string;
  inStock?: boolean;
  sort?: SortOption;
  page?: number;
  perPage?: number;
};

export type ProductListItem = {
  id: string;
  name: string;
  description: string | null;
  priceYen: number;
  imageUrl: string | null;
  averageRating: string | null;
  reviewCount: number;
  salesCount: number;
  favoriteCount: number;
  intensity: string | null;
  isLimited: boolean;
  creatorId: string | null;
  tags: { type: string; value: string }[];
  minPrice: number | null;
  createdAt: Date;
};

export type SearchResult = {
  products: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// searchProducts
// ---------------------------------------------------------------------------

export async function searchProducts(
  params: SearchParams,
): Promise<SearchResult> {
  const page = Math.max(params.page ?? 1, 1);
  const perPage = Math.min(Math.max(params.perPage ?? 20, 1), 100);
  const offset = (page - 1) * perPage;

  // Build WHERE conditions
  const conditions: SQL[] = [
    eq(products.isActive, true),
    isNull(products.deletedAt),
  ];

  // Text search
  if (params.q) {
    const pattern = `%${params.q}%`;
    const textSearch = or(
      ilike(products.name, pattern),
      ilike(products.description, pattern),
    );
    if (textSearch) {
      conditions.push(textSearch);
    }
  }

  // Creator filter
  if (params.creatorId) {
    conditions.push(eq(products.creatorId, params.creatorId));
  }

  // Price range filters
  if (params.priceMin != null) {
    conditions.push(gte(products.priceYen, params.priceMin));
  }
  if (params.priceMax != null) {
    conditions.push(lte(products.priceYen, params.priceMax));
  }

  // Intensity filter
  if (params.intensity) {
    conditions.push(eq(products.intensity, params.intensity));
  }

  // Min rating filter
  if (params.minRating != null) {
    conditions.push(gte(products.averageRating, String(params.minRating)));
  }

  // Tag filters (season, scene, feature)
  const tagFilter = (type: TagType, value: string) =>
    inArray(
      products.id,
      db
        .select({ productId: productTags.productId })
        .from(productTags)
        .where(and(eq(productTags.type, type), eq(productTags.value, value))),
    );

  if (params.season) {
    conditions.push(tagFilter("season", params.season));
  }
  if (params.scene) {
    conditions.push(tagFilter("scene", params.scene));
  }
  if (params.feature) {
    conditions.push(tagFilter("feature", params.feature));
  }

  // Volume filter
  if (params.volume != null) {
    conditions.push(
      inArray(
        products.id,
        db
          .select({ productId: productVariants.productId })
          .from(productVariants)
          .where(eq(productVariants.volume, params.volume)),
      ),
    );
  }

  // In-stock filter (default: true)
  if (params.inStock !== false) {
    conditions.push(
      inArray(
        products.id,
        db
          .select({ productId: productVariants.productId })
          .from(productVariants)
          .where(gte(productVariants.stock, 1)),
      ),
    );
  }

  const whereClause = and(...conditions) ?? sql`true`;

  // Sort
  const orderBy = buildOrderBy(params.sort ?? "newest");

  // Count total
  const [countResult] = await db
    .select({ total: count() })
    .from(products)
    .where(whereClause);

  const total = countResult?.total ?? 0;
  const totalPages = Math.ceil(total / perPage);

  if (total === 0) {
    return { products: [], total: 0, page, perPage, totalPages: 0 };
  }

  // Fetch products
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      priceYen: products.priceYen,
      imageUrl: products.imageUrl,
      averageRating: products.averageRating,
      reviewCount: products.reviewCount,
      salesCount: products.salesCount,
      favoriteCount: products.favoriteCount,
      intensity: products.intensity,
      isLimited: products.isLimited,
      creatorId: products.creatorId,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(perPage)
    .offset(offset);

  if (rows.length === 0) {
    return { products: [], total, page, perPage, totalPages };
  }

  const productIds = rows.map((r) => r.id);

  // Fetch tags and minPrice in parallel
  const [tagRows, minPriceRows] = await Promise.all([
    db
      .select({
        productId: productTags.productId,
        type: productTags.type,
        value: productTags.value,
      })
      .from(productTags)
      .where(inArray(productTags.productId, productIds)),
    db
      .select({
        productId: productVariants.productId,
        minPrice: sql<number>`min(${productVariants.price})`.as("min_price"),
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds))
      .groupBy(productVariants.productId),
  ]);

  // Build lookup maps
  const tagMap = new Map<string, { type: string; value: string }[]>();
  for (const tag of tagRows) {
    const list = tagMap.get(tag.productId) ?? [];
    list.push({ type: tag.type, value: tag.value });
    tagMap.set(tag.productId, list);
  }

  const minPriceMap = new Map<string, number>();
  for (const row of minPriceRows) {
    minPriceMap.set(row.productId, row.minPrice);
  }

  // Assemble result
  const productList: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    priceYen: r.priceYen,
    imageUrl: r.imageUrl,
    averageRating: r.averageRating,
    reviewCount: r.reviewCount,
    salesCount: r.salesCount,
    favoriteCount: r.favoriteCount,
    intensity: r.intensity,
    isLimited: r.isLimited,
    creatorId: r.creatorId,
    tags: tagMap.get(r.id) ?? [],
    minPrice: minPriceMap.get(r.id) ?? null,
    createdAt: r.createdAt,
  }));

  return {
    products: productList,
    total,
    page,
    perPage,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOrderBy(sort: SortOption) {
  switch (sort) {
    case "newest":
      return desc(products.createdAt);
    case "popular":
      return desc(products.salesCount);
    case "price-asc":
      return asc(products.priceYen);
    case "price-desc":
      return desc(products.priceYen);
    case "rating":
      return desc(products.averageRating);
    case "reviews":
      return desc(products.reviewCount);
    case "sales":
      return desc(products.salesCount);
    case "favorites":
      return desc(products.favoriteCount);
    default:
      return desc(products.createdAt);
  }
}
