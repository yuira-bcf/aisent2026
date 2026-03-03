import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  creatorProfiles,
  creatorStats,
  products,
} from "@kyarainnovate/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "こんばんは";
  if (hour < 12) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [topCreators, latestProducts] = await Promise.all([
    db
      .select({
        userId: creatorProfiles.userId,
        displayName: creatorProfiles.displayName,
        creatorIdSlug: creatorProfiles.creatorIdSlug,
        avatarUrl: creatorProfiles.avatarUrl,
        bio: creatorProfiles.bio,
        tier: creatorStats.tier,
      })
      .from(creatorProfiles)
      .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
      .where(eq(creatorProfiles.isActive, true))
      .orderBy(desc(creatorStats.tierScore))
      .limit(3),
    db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt))
      .limit(3),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-sm text-gray-400">{getGreeting()}</p>
          <h1 className="text-xl font-bold tracking-tight text-black">
            {session.user.name} さん
          </h1>
        </div>
        <Link
          href="/notifications"
          className="w-10 h-10 flex items-center justify-center border border-gray-200 hover:border-black transition"
        >
          <span className="material-symbols-outlined text-xl">
            notifications
          </span>
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="border border-black p-8 mb-10">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">
          Your Signature Scent
        </p>
        <h2 className="text-lg font-bold text-black mb-1">
          あなただけの香りをつくろう
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          AIとクリエイターの力で、世界にひとつだけのフレグランスを
        </p>
        <Link
          href="/blend"
          className="inline-block bg-black text-white text-sm px-6 py-3 hover:bg-gray-800 transition"
        >
          調香をはじめる
        </Link>
      </div>

      {/* Pickup Creators */}
      {topCreators.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-black">
              ピックアップクリエイター
            </h3>
            <Link
              href="/creators"
              className="text-xs text-gray-400 hover:text-black transition"
            >
              すべて見る
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
            {topCreators.map((creator) => (
              <Link
                key={creator.userId}
                href={`/creators/${creator.creatorIdSlug}`}
                className="flex-shrink-0 w-40 border border-gray-200 p-4 hover:border-black transition"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                  {creator.avatarUrl ? (
                    <img
                      src={creator.avatarUrl}
                      alt={creator.displayName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-xl text-gray-400">
                      person
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-black text-center truncate">
                  {creator.displayName}
                </p>
                <p className="text-xs text-gray-400 text-center">
                  {creator.tier}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* New Products */}
      {latestProducts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-black">新着商品</h3>
            <Link
              href="/shop"
              className="text-xs text-gray-400 hover:text-black transition"
            >
              すべて見る
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {latestProducts.map((product) => (
              <Link
                key={product.id}
                href={`/shop/products/${product.id}`}
                className="border border-gray-200 p-4 hover:border-black transition"
              >
                {product.imageUrl ? (
                  <div className="aspect-square bg-gray-50 mb-3 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-50 mb-3 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-gray-300">
                      spa
                    </span>
                  </div>
                )}
                <p className="text-sm font-medium text-black truncate">
                  {product.name}
                </p>
                <p className="text-sm font-bold text-black">
                  ¥{product.priceYen.toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
