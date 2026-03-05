import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@kyarainnovate/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CreatorProductsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const myProducts = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      priceYen: products.priceYen,
      isActive: products.isActive,
      intensity: products.intensity,
      isLimited: products.isLimited,
      manufacturingDays: products.manufacturingDays,
      averageRating: products.averageRating,
      reviewCount: products.reviewCount,
      salesCount: products.salesCount,
      favoriteCount: products.favoriteCount,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(
      and(eq(products.creatorId, session.user.id), isNull(products.deletedAt)),
    )
    .orderBy(desc(products.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">出品管理</h1>
          <p className="text-sm text-gray-400">あなたの商品を管理</p>
        </div>
        <Link
          href="/creator/products/new"
          className="bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">add</span>
          新規出品
        </Link>
      </div>

      {myProducts.length === 0 ? (
        <div className="border border-gray-200 px-4 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
            inventory_2
          </span>
          <p className="text-sm text-gray-400 mb-4">
            まだ出品された商品はありません
          </p>
          <Link
            href="/creator/products/new"
            className="inline-block bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition"
          >
            最初の商品を出品する
          </Link>
        </div>
      ) : (
        <div className="border border-gray-200">
          {/* Header */}
          <div className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>商品名</span>
            <span>価格</span>
            <span>ステータス</span>
            <span>評価</span>
            <span>登録日</span>
          </div>

          {/* Rows */}
          {myProducts.map((product) => (
            <Link
              key={product.id}
              href={`/creator/products/new?edit=${product.id}`}
              className="grid grid-cols-[1fr_0.5fr_0.5fr_0.5fr_0.6fr] gap-2 px-4 py-3 border-b border-gray-100 items-center text-sm hover:bg-gray-50 transition"
            >
              <span className="font-medium text-black truncate flex items-center gap-1">
                {product.name}
                {product.isLimited && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 font-medium">
                    限定
                  </span>
                )}
              </span>
              <span className="font-medium text-black">
                ¥{product.priceYen.toLocaleString()}
              </span>
              <span>
                <span
                  className={`text-xs px-2 py-0.5 font-medium ${
                    product.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {product.isActive ? "販売中" : "非公開"}
                </span>
              </span>
              <span className="text-xs text-gray-600">
                {product.averageRating &&
                Number.parseFloat(product.averageRating) > 0
                  ? `★ ${product.averageRating} (${product.reviewCount})`
                  : "-"}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(product.createdAt).toLocaleDateString("ja-JP")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
