import FavoriteHeart from "@/components/favorite-heart";
import Link from "next/link";
import AddToCartButton from "./add-to-cart-button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProductCardProps = {
  product: {
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
    createdAt: Date;
  };
  favorited: boolean;
  gradient: string;
  donut: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const intensityLabel: Record<string, string> = {
  light: "ライト",
  medium: "ミディアム",
  strong: "ストロング",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductCard({
  product,
  favorited,
  gradient,
  donut,
}: ProductCardProps) {
  const rating = product.averageRating
    ? Number.parseFloat(product.averageRating)
    : 0;

  return (
    <div className="card overflow-hidden hover:shadow-sm transition cursor-pointer group relative">
      <Link href={`/shop/${product.id}`} className="block">
        <div className="h-28 relative" style={{ background: gradient }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full"
                style={{ background: donut }}
              >
                <div className="w-9 h-9 rounded-full bg-white mt-3.5 ml-3.5" />
              </div>
            )}
          </div>
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {product.isLimited && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-medium rounded">
                LIMITED
              </span>
            )}
            {product.intensity && (
              <span className="px-1.5 py-0.5 bg-gray-800 text-white text-[8px] font-medium rounded">
                {intensityLabel[product.intensity] ?? product.intensity}
              </span>
            )}
          </div>
          {/* Favorite */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
            <FavoriteHeart
              productId={product.id}
              initialFavorited={favorited}
            />
          </div>
        </div>
      </Link>
      <div className="p-3">
        <p className="text-[12px] font-bold text-black mb-0.5">
          {product.name}
        </p>
        {product.description && (
          <p className="text-[9px] text-gray-400 mb-1 line-clamp-1">
            {product.description}
          </p>
        )}
        {/* Rating + Review count */}
        {rating > 0 && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-amber-500">
              {"★".repeat(Math.round(rating))}
            </span>
            <span className="text-[9px] text-gray-400">
              {rating.toFixed(1)} ({product.reviewCount})
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[13px] font-bold text-black">
              ¥{product.priceYen.toLocaleString()}
            </span>
            {product.salesCount > 0 && (
              <span className="text-[8px] text-gray-400 ml-1">
                {product.salesCount}個販売
              </span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition">
            <AddToCartButton productId={product.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
