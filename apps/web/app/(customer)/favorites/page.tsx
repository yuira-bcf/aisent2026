import FavoriteHeart from "@/components/favorite-heart";
import { auth } from "@/lib/auth";
import { getProductFavorites } from "@/lib/services/product-favorite-service";
import Link from "next/link";
import { redirect } from "next/navigation";
import AddToCartButton from "../shop/add-to-cart-button";

export default async function FavoritesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { items } = await getProductFavorites(session.user.id, 1, 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            お気に入り
          </h1>
          <p className="text-sm text-gray-400">{items.length}件の商品</p>
        </div>
        <Link
          href="/shop"
          className="px-4 py-2 text-sm border border-gray-200 hover:border-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">
            storefront
          </span>
          ショップ
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="border border-gray-200 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            favorite_border
          </span>
          <p className="text-sm text-gray-400 mb-4">
            お気に入りの商品はまだありません
          </p>
          <Link
            href="/shop"
            className="inline-block px-4 py-2 text-sm bg-black text-white hover:bg-gray-800 transition"
          >
            ショップを見る
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.favoriteId}
              className="border border-gray-200 p-6 flex flex-col relative"
            >
              <div className="absolute top-2 right-2 z-10">
                <FavoriteHeart
                  productId={item.product.id}
                  initialFavorited={true}
                />
              </div>
              {item.product.imageUrl ? (
                <div className="mb-4 aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="mb-4 aspect-square bg-gray-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-gray-300">
                    spa
                  </span>
                </div>
              )}
              <h2 className="text-sm font-medium text-black mb-1">
                {item.product.name}
              </h2>
              <p className="text-lg font-bold text-black mb-2">
                ¥{item.product.priceYen.toLocaleString()}
              </p>
              {item.product.description && (
                <p className="text-xs text-gray-400 mb-4 line-clamp-2 flex-1">
                  {item.product.description}
                </p>
              )}
              {!item.product.description && <div className="flex-1" />}
              <AddToCartButton productId={item.product.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
