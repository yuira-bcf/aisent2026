import FavoriteHeart from "@/components/favorite-heart";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isProductFavorited } from "@/lib/services/product-favorite-service";
import { products } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AddToCartButton from "../add-to-cart-button";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.isActive, true)));

  if (!product) notFound();

  const favorited = await isProductFavorited(session.user.id, product.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/shop"
        className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1 mb-8"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        ショップに戻る
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product image */}
        <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="material-symbols-outlined text-gray-300"
              style={{ fontSize: 200 }}
            >
              spa
            </span>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {product.name}
            </h1>
            <FavoriteHeart
              productId={product.id}
              initialFavorited={favorited}
            />
          </div>

          <p className="text-2xl font-bold text-black mb-6">
            ¥{product.priceYen.toLocaleString()}
          </p>

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-8">
              {product.description}
            </p>
          )}

          <div className="mt-auto">
            <AddToCartButton productId={product.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
