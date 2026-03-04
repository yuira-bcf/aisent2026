import FavoriteHeart from "@/components/favorite-heart";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserFavoritedProductIds } from "@/lib/services/product-favorite-service";
import { products } from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import AddToCartButton from "./add-to-cart-button";

export default async function ShopPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt));

  const favoritedIds = await getUserFavoritedProductIds(session.user.id);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex gap-5">
        {/* Left: Filters Sidebar */}
        <div className="w-[200px] shrink-0 space-y-4 hidden md:block">
          {/* Search */}
          <div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="商品名・クリエーター名..."
                className="w-full border border-gray-200 pl-8 pr-3 py-2 text-[11px] focus:border-black focus:outline-none rounded"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              カテゴリ
            </p>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-black text-white text-[11px] cursor-pointer">
                <span className="material-symbols-outlined text-[14px]">
                  grid_view
                </span>
                すべて
                <span className="ml-auto text-[9px] opacity-60">
                  {allProducts.length}
                </span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-gray-600 hover:bg-gray-50 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                Fresh Floral
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-gray-600 hover:bg-gray-50 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Warm Floral
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-gray-600 hover:bg-gray-50 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Fresh Woody
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-gray-600 hover:bg-gray-50 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Warm Woody
              </div>
            </div>
          </div>

          {/* Price */}
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              価格帯
            </p>
            <input
              type="range"
              min="3000"
              max="15000"
              defaultValue="15000"
              className="w-full mb-1"
            />
            <div className="flex items-center gap-1">
              <input
                type="text"
                defaultValue="¥3,000"
                className="w-1/2 border border-gray-200 px-2 py-1 text-[10px] text-center rounded"
                readOnly
              />
              <span className="text-[10px] text-gray-300">—</span>
              <input
                type="text"
                defaultValue="¥15,000"
                className="w-1/2 border border-gray-200 px-2 py-1 text-[10px] text-center rounded"
                readOnly
              />
            </div>
          </div>

          {/* Volume */}
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              容量
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="px-2.5 py-1 text-[10px] bg-black text-white rounded"
              >
                ALL
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-[10px] border border-gray-200 text-gray-500 rounded hover:border-black"
              >
                30ml
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-[10px] border border-gray-200 text-gray-500 rounded hover:border-black"
              >
                50ml
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-[10px] border border-gray-200 text-gray-500 rounded hover:border-black"
              >
                100ml
              </button>
            </div>
          </div>

          {/* Season */}
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              季節
            </p>
            <div className="flex gap-1 flex-wrap">
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-[10px] text-gray-500 cursor-pointer hover:border-black">
                <input type="checkbox" className="w-3 h-3 accent-black" /> 春
              </label>
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-[10px] text-gray-500 cursor-pointer hover:border-black">
                <input type="checkbox" className="w-3 h-3 accent-black" /> 夏
              </label>
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-[10px] text-gray-500 cursor-pointer hover:border-black">
                <input type="checkbox" className="w-3 h-3 accent-black" /> 秋
              </label>
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-[10px] text-gray-500 cursor-pointer hover:border-black">
                <input type="checkbox" className="w-3 h-3 accent-black" /> 冬
              </label>
            </div>
          </div>

          {/* Rating */}
          <div>
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              評価
            </p>
            <div className="space-y-0.5">
              <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  className="w-3 h-3 accent-black"
                />{" "}
                ★4.0 以上
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  className="w-3 h-3 accent-black"
                />{" "}
                ★3.5 以上
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  className="w-3 h-3 accent-black"
                  defaultChecked
                />{" "}
                すべて
              </label>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] text-gray-600 cursor-pointer">
              在庫ありのみ
              <div className="w-8 h-4 rounded-full bg-black relative">
                <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 right-0.5 shadow-sm" />
              </div>
            </div>
          </div>

          {/* Clear */}
          <button
            type="button"
            className="w-full py-1.5 text-[10px] text-gray-400 hover:text-black border border-gray-200 rounded transition"
          >
            フィルターをクリア
          </button>
        </div>

        {/* Right: Product Grid */}
        <div className="flex-1 min-w-0">
          {/* Header: Title + Sort + View */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-black">商品一覧</h1>
              <span className="text-[11px] text-gray-400">
                {allProducts.length}件
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select className="border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-600 rounded focus:border-black focus:outline-none">
                <option>おすすめ順</option>
                <option>人気順</option>
                <option>新着順</option>
                <option>価格 安い順</option>
                <option>価格 高い順</option>
                <option>評価順</option>
              </select>
              <div className="flex border border-gray-200 rounded overflow-hidden">
                <button
                  type="button"
                  className="px-2 py-1.5 bg-black text-white"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    grid_view
                  </span>
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 text-gray-400 hover:text-black"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    view_list
                  </span>
                </button>
              </div>
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
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[9px] text-gray-400">適用中:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-[10px] text-gray-600 rounded">
              在庫あり{" "}
              <button
                type="button"
                className="text-gray-400 hover:text-black ml-0.5"
              >
                x
              </button>
            </span>
          </div>

          {allProducts.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
                storefront
              </span>
              <p className="text-sm text-gray-400">
                現在販売中の商品はありません
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {allProducts.map((product, idx) => {
                const bg = gradients[idx % gradients.length];
                const donut = donutColors[idx % donutColors.length];
                return (
                  <div
                    key={product.id}
                    className="card overflow-hidden hover:shadow-sm transition cursor-pointer group relative"
                  >
                    <Link href={`/shop/${product.id}`} className="block">
                      <div className="h-28 relative" style={{ background: bg }}>
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
                        {idx === 0 && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            <span className="px-1.5 py-0.5 bg-black text-white text-[8px] font-medium rounded">
                              BEST SELLER
                            </span>
                          </div>
                        )}
                        {idx === 1 && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-medium rounded">
                              NEW
                            </span>
                          </div>
                        )}
                        {/* Favorite */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                          <FavoriteHeart
                            productId={product.id}
                            initialFavorited={favoritedIds.has(product.id)}
                          />
                        </div>
                      </div>
                    </Link>
                    <div className="p-3">
                      <p className="text-[12px] font-bold text-black mb-0.5">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="text-[9px] text-gray-400 mb-1.5 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[13px] font-bold text-black">
                            ¥{product.priceYen.toLocaleString()}
                          </span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition">
                          <AddToCartButton productId={product.id} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
