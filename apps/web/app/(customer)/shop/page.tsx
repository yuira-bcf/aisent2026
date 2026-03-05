import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserFavoritedProductIds } from "@/lib/services/product-favorite-service";
import {
  type TagType,
  productTags,
  productVariants,
  products,
} from "@kyarainnovate/db/schema";
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
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProductCard from "./product-card";
import ShopFilters from "./shop-filters";
import ShopPagination from "./shop-pagination";
import SortSelect from "./sort-select";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PER_PAGE = 20;

const gradients = [
  "linear-gradient(135deg,#fef3c7,#fce7f3)",
  "linear-gradient(135deg,#e0f2fe,#dbeafe)",
  "linear-gradient(135deg,#fce7f3,#f5f3ff)",
  "linear-gradient(135deg,#fef3c7,#fff7ed)",
  "linear-gradient(135deg,#ecfdf5,#f0fdf4)",
  "linear-gradient(135deg,#ede9fe,#fae8ff)",
];

const donutColors = [
  "conic-gradient(#f59e0b 0% 15%, #fbbf24 15% 25%, #ec4899 25% 45%, #f472b6 45% 60%, #a78bfa 60% 75%, #c4b5fd 75% 85%, #34d399 85% 100%)",
  "conic-gradient(#3b82f6 0% 30%, #06b6d4 30% 50%, #34d399 50% 75%, #fbbf24 75% 100%)",
  "conic-gradient(#ec4899 0% 35%, #f472b6 35% 55%, #a78bfa 55% 75%, #fbbf24 75% 100%)",
  "conic-gradient(#f59e0b 0% 35%, #dc2626 35% 55%, #78716c 55% 80%, #a16207 80% 100%)",
  "conic-gradient(#10b981 0% 40%, #34d399 40% 60%, #fbbf24 60% 80%, #f59e0b 80% 100%)",
  "conic-gradient(#8b5cf6 0% 30%, #d946ef 30% 55%, #f472b6 55% 75%, #fbbf24 75% 100%)",
];

type SortKey =
  | "newest"
  | "popular"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "reviews"
  | "sales"
  | "favorites";

function getSortOrder(sort: SortKey) {
  switch (sort) {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const str = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    return v ? Number(v) : undefined;
  };

  const q = str("q");
  const season = str("season");
  const scene = str("scene");
  const feature = str("feature");
  const intensity = str("intensity");
  const volumeFilter = num("volume");
  const minRating = num("minRating");
  const priceMin = num("priceMin");
  const priceMax = num("priceMax");
  const inStock = str("inStock") !== "false";
  const sort = (str("sort") ?? "newest") as SortKey;
  const page = Math.max(1, num("page") ?? 1);

  // Build WHERE conditions
  const conditions: SQL[] = [
    eq(products.isActive, true),
    isNull(products.deletedAt),
  ];

  if (q) {
    conditions.push(
      or(
        ilike(products.name, `%${q}%`),
        ilike(products.description, `%${q}%`),
      ) as SQL,
    );
  }

  if (intensity) {
    conditions.push(eq(products.intensity, intensity));
  }

  if (priceMin) {
    conditions.push(gte(products.priceYen, priceMin));
  }

  if (priceMax) {
    conditions.push(lte(products.priceYen, priceMax));
  }

  if (minRating) {
    conditions.push(gte(products.averageRating, String(minRating)));
  }

  // Tag-based filters (subquery)
  const tagFilter = (type: TagType, value: string) =>
    inArray(
      products.id,
      db
        .select({ pid: productTags.productId })
        .from(productTags)
        .where(and(eq(productTags.type, type), eq(productTags.value, value))),
    );

  if (season) conditions.push(tagFilter("season", season));
  if (scene) conditions.push(tagFilter("scene", scene));
  if (feature) conditions.push(tagFilter("feature", feature));

  // Volume filter (subquery)
  if (volumeFilter) {
    conditions.push(
      inArray(
        products.id,
        db
          .select({ pid: productVariants.productId })
          .from(productVariants)
          .where(eq(productVariants.volume, volumeFilter)),
      ),
    );
  }

  // Stock filter (subquery)
  if (inStock) {
    conditions.push(
      or(
        // Has in-stock variant
        inArray(
          products.id,
          db
            .select({ pid: productVariants.productId })
            .from(productVariants)
            .where(sql`${productVariants.stock} > 0`),
        ),
        // Or has no variants at all (legacy products)
        sql`NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = ${products.id})`,
      ) as SQL,
    );
  }

  const where = and(...conditions);

  // Fetch count + products in parallel
  const [totalResult, allProducts] = await Promise.all([
    db.select({ value: count() }).from(products).where(where),
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(getSortOrder(sort))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
  ]);

  const total = totalResult[0]?.value ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  const favoritedIds = await getUserFavoritedProductIds(session.user.id);

  // Active filters for display
  const activeFilters: { label: string; key: string }[] = [];
  if (q) activeFilters.push({ label: `"${q}"`, key: "q" });
  if (season) activeFilters.push({ label: `季節: ${season}`, key: "season" });
  if (scene) activeFilters.push({ label: `シーン: ${scene}`, key: "scene" });
  if (intensity)
    activeFilters.push({ label: `強さ: ${intensity}`, key: "intensity" });
  if (volumeFilter)
    activeFilters.push({ label: `${volumeFilter}ml`, key: "volume" });
  if (minRating)
    activeFilters.push({ label: `★${minRating}+`, key: "minRating" });
  if (priceMin)
    activeFilters.push({
      label: `¥${priceMin.toLocaleString()}〜`,
      key: "priceMin",
    });
  if (priceMax)
    activeFilters.push({
      label: `〜¥${priceMax.toLocaleString()}`,
      key: "priceMax",
    });
  if (inStock) activeFilters.push({ label: "在庫あり", key: "inStock" });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex gap-5">
        {/* Left: Filters Sidebar */}
        <Suspense fallback={null}>
          <ShopFilters total={total} />
        </Suspense>

        {/* Right: Product Grid */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-black">商品一覧</h1>
              <span className="text-[11px] text-gray-400">{total}件</span>
            </div>
            <div className="flex items-center gap-2">
              <Suspense fallback={null}>
                <SortSelect />
              </Suspense>
              <Link
                href="/cart"
                className="px-3 py-1.5 text-[11px] border border-gray-200 hover:border-black transition flex items-center gap-1 rounded"
              >
                <span className="material-symbols-outlined text-[14px]">
                  shopping_cart
                </span>
                カート
              </Link>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="text-[9px] text-gray-400">適用中:</span>
              {activeFilters.map((f) => (
                <span
                  key={f.key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-[10px] text-gray-600 rounded"
                >
                  {f.label}
                </span>
              ))}
            </div>
          )}

          {allProducts.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
                storefront
              </span>
              <p className="text-sm text-gray-400">
                条件に一致する商品が見つかりません
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allProducts.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    favorited={favoritedIds.has(product.id)}
                    gradient={gradients[idx % gradients.length]}
                    donut={donutColors[idx % donutColors.length]}
                  />
                ))}
              </div>
              <Suspense fallback={null}>
                <ShopPagination page={page} totalPages={totalPages} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
