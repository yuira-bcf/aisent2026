"use client";

import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Recipe = {
  id: string;
  name: string;
  creatorName: string;
  orderCount: number;
  price30ml: number | null;
  matchScore?: number;
};

type Creator = {
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  bio: string | null;
  tier: string;
  avgRating: string;
};

type Recommendations = {
  recipes: Recipe[];
  creators: Creator[];
};

const tierLabelMap: Record<string, string> = {
  APPRENTICE: "Apprentice",
  ARTISAN: "Artisan",
  EXPERT: "Expert",
  MASTER: "Master",
  GRAND_MASTER: "Grand Master",
};

function SkeletonCard() {
  return (
    <div className="min-w-[200px] border border-gray-200 p-4 animate-pulse">
      <div className="h-4 bg-gray-100 mb-3 w-3/4" />
      <div className="h-3 bg-gray-100 mb-2 w-1/2" />
      <div className="h-3 bg-gray-100 w-1/3" />
    </div>
  );
}

export default function RecommendationCarousel() {
  const [data, setData] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Recommendations>("/api/v1/personalization/recommendations")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (
    !loading &&
    (!data || (data.recipes.length === 0 && data.creators.length === 0))
  ) {
    return null;
  }

  return (
    <div className="space-y-10">
      {/* Recommended Recipes */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-black mb-1">
          おすすめレシピ
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          あなたの調合履歴に基づくおすすめ
        </p>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            data?.recipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/shop/${recipe.id}`}
                className="min-w-[200px] border border-gray-200 p-4 hover:border-black transition flex-shrink-0"
              >
                <p className="text-sm font-bold text-black mb-1 truncate">
                  {recipe.name}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  {recipe.creatorName}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      shopping_bag
                    </span>
                    {recipe.orderCount}
                  </span>
                  {recipe.price30ml != null && (
                    <span>{recipe.price30ml.toLocaleString()}円</span>
                  )}
                </div>
              </Link>
            ))
          )}
          {!loading && data?.recipes.length === 0 && (
            <p className="text-sm text-gray-400">
              まだおすすめレシピはありません
            </p>
          )}
        </div>
      </div>

      {/* Recommended Creators */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-black mb-1">
          おすすめクリエイター
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          まだ試していないクリエイター
        </p>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            data?.creators.map((creator) => (
              <Link
                key={creator.userId}
                href={`/creators/${creator.creatorIdSlug}`}
                className="min-w-[200px] border border-gray-200 p-4 hover:border-black transition flex-shrink-0"
              >
                <p className="text-sm font-bold text-black mb-1 truncate">
                  {creator.displayName}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700">
                    {tierLabelMap[creator.tier] ?? creator.tier}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="material-symbols-outlined text-sm">
                    star
                  </span>
                  <span>{Number(creator.avgRating).toFixed(1)}</span>
                </div>
              </Link>
            ))
          )}
          {!loading && data?.creators.length === 0 && (
            <p className="text-sm text-gray-400">
              まだおすすめクリエイターはいません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
