import FavoriteHeart from "@/components/favorite-heart";
import { auth } from "@/lib/auth";
import { isProductFavorited } from "@/lib/services/product-favorite-service";
import { getProductDetail } from "@/lib/services/product-service";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AddToCartWithVariant from "./add-to-cart-with-variant";
import BlendChart from "./blend-chart";
import ImageGallery from "./image-gallery";
import ReviewsSection from "./reviews-section";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const intensityLabel: Record<string, string> = {
  light: "ライト",
  medium: "ミディアム",
  strong: "ストロング",
};

const tierLabel: Record<string, string> = {
  APPRENTICE: "アプレンティス",
  BRONZE: "ブロンズ",
  SILVER: "シルバー",
  GOLD: "ゴールド",
  PLATINUM: "プラチナ",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product || !product.isActive) notFound();

  const favorited = await isProductFavorited(session.user.id, product.id);

  const rating = product.averageRating
    ? Number.parseFloat(product.averageRating)
    : 0;

  // Prepare variants for client component (strip server-only fields)
  const clientVariants = product.variants.map((v) => ({
    id: v.id,
    volume: v.volume,
    price: v.price,
    effectivePrice: v.effectivePrice,
    stock: v.stock,
    stockStatus: v.stockStatus,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <Link
        href="/shop"
        className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1 mb-6"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        ショップに戻る
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image Gallery */}
        <ImageGallery images={product.images} productName={product.name} />

        {/* Right: Product Info */}
        <div className="flex flex-col">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            {product.isLimited && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded">
                LIMITED
              </span>
            )}
            {product.intensity && (
              <span className="px-2 py-0.5 bg-gray-800 text-white text-xs font-medium rounded">
                {intensityLabel[product.intensity] ?? product.intensity}
              </span>
            )}
          </div>

          {/* Name + Favorite */}
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {product.name}
            </h1>
            <FavoriteHeart
              productId={product.id}
              initialFavorited={favorited}
            />
          </div>

          {/* Price */}
          <p className="text-2xl font-bold text-black mb-2">
            ¥{product.priceYen.toLocaleString()}
          </p>

          {/* Rating */}
          {rating > 0 && (
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-amber-500 text-sm">
                {"★".repeat(Math.round(rating))}
                {"☆".repeat(5 - Math.round(rating))}
              </span>
              <span className="text-sm text-gray-500">
                {rating.toFixed(1)} ({product.reviewCount}件)
              </span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {product.description}
            </p>
          )}

          {/* Creator info */}
          {product.creator && (
            <Link
              href={`/creators/${product.creator.slug}`}
              className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <span className="material-symbols-outlined text-gray-400">
                person
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {product.creator.displayName}
                </p>
                <p className="text-xs text-gray-400">
                  {tierLabel[product.creator.tier] ?? product.creator.tier}
                  {Number.parseFloat(product.creator.avgRating) > 0 &&
                    ` / 評価 ${product.creator.avgRating}`}
                </p>
              </div>
            </Link>
          )}

          {/* Recipe info */}
          {product.recipe && (
            <div className="mb-6 text-sm text-gray-600 space-y-1">
              {product.recipe.concept && (
                <p>
                  <span className="font-medium text-gray-700">コンセプト:</span>{" "}
                  {product.recipe.concept}
                </p>
              )}
              {product.recipe.scene && (
                <p>
                  <span className="font-medium text-gray-700">シーン:</span>{" "}
                  {product.recipe.scene}
                </p>
              )}
              {product.recipe.mood && (
                <p>
                  <span className="font-medium text-gray-700">ムード:</span>{" "}
                  {product.recipe.mood}
                </p>
              )}
            </div>
          )}

          {/* Add to cart with variant selection */}
          <div className="mb-6">
            <AddToCartWithVariant
              productId={product.id}
              variants={clientVariants}
            />
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-6">
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {tag.value}
                </span>
              ))}
            </div>
          )}

          {/* Manufacturing info */}
          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-gray-400">
                schedule
              </span>
              製造日数: {product.manufacturingDays}日
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-gray-400">
                redeem
              </span>
              ギフトラッピング:{" "}
              {product.giftWrappingAvailable ? "対応可" : "非対応"}
            </div>
          </div>
        </div>
      </div>

      {/* Blend Chart */}
      {product.recipeFlavors.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-black mb-6">配合チャート</h2>
          <BlendChart flavors={product.recipeFlavors} />
        </section>
      )}

      {/* AI Story */}
      {product.aiStory && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-black mb-4">ストーリー</h2>
          <div className="bg-gradient-to-br from-violet-50 to-pink-50 rounded-lg p-6">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {product.aiStory}
            </p>
          </div>
        </section>
      )}

      {/* Reviews */}
      {product.recipeId && (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-black mb-6">
            レビュー ({product.reviewCount})
          </h2>
          <ReviewsSection recipeId={product.recipeId} />
        </section>
      )}

      {/* Stats row */}
      <section className="mt-10 border-t border-gray-100 pt-6">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          {product.salesCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-gray-400">
                shopping_bag
              </span>
              {product.salesCount}個販売
            </div>
          )}
          {product.favoriteCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-gray-400">
                favorite
              </span>
              {product.favoriteCount}件のお気に入り
            </div>
          )}
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-gray-400">
                star
              </span>
              評価 {rating.toFixed(1)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
