import { safeHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { searchProducts } from "@/lib/services/shop-service";
import type { NextRequest } from "next/server";

/**
 * GET /api/v1/shop/products
 *
 * Search, filter, sort & paginate products (public).
 */
export const GET = safeHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const params = {
    q: url.searchParams.get("q") || undefined,
    creatorId: url.searchParams.get("creatorId") || undefined,
    priceMin: url.searchParams.get("priceMin")
      ? Number(url.searchParams.get("priceMin"))
      : undefined,
    priceMax: url.searchParams.get("priceMax")
      ? Number(url.searchParams.get("priceMax"))
      : undefined,
    volume: url.searchParams.get("volume")
      ? Number(url.searchParams.get("volume"))
      : undefined,
    season: url.searchParams.get("season") || undefined,
    scene: url.searchParams.get("scene") || undefined,
    feature: url.searchParams.get("feature") || undefined,
    minRating: url.searchParams.get("minRating")
      ? Number(url.searchParams.get("minRating"))
      : undefined,
    intensity: url.searchParams.get("intensity") || undefined,
    inStock: url.searchParams.get("inStock") !== "false",
    sort: (url.searchParams.get("sort") || "newest") as
      | "newest"
      | "popular"
      | "price-asc"
      | "price-desc"
      | "rating"
      | "reviews"
      | "sales"
      | "favorites",
    page: url.searchParams.get("page")
      ? Number(url.searchParams.get("page"))
      : 1,
    perPage: url.searchParams.get("perPage")
      ? Number(url.searchParams.get("perPage"))
      : 20,
  };

  const result = await searchProducts(params);
  return apiSuccess(result);
});
