import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, creatorStats } from "@kyarainnovate/db/schema";
import type { Tier } from "@kyarainnovate/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 120;

const tierBadge: Record<Tier, { label: string; className: string }> = {
  APPRENTICE: { label: "Apprentice", className: "bg-gray-100 text-gray-600" },
  ARTISAN: { label: "Artisan", className: "bg-blue-50 text-blue-700" },
  EXPERT: { label: "Expert", className: "bg-purple-50 text-purple-700" },
  MASTER: { label: "Master", className: "bg-amber-50 text-amber-700" },
  GRAND_MASTER: { label: "Grand Master", className: "bg-red-50 text-red-700" },
};

type AwardCreator = {
  userId: string;
  displayName: string;
  creatorIdSlug: string;
  avatarUrl: string | null;
  tier: Tier;
  avgRating: string;
  recipeSalesCount: number;
  favoriteCount: number;
};

async function getAwardCreators(): Promise<{
  topCreators: AwardCreator[];
  popularRecipes: AwardCreator[];
  favorites: AwardCreator[];
}> {
  const rows = await db
    .select({
      userId: creatorProfiles.userId,
      displayName: creatorProfiles.displayName,
      creatorIdSlug: creatorProfiles.creatorIdSlug,
      avatarUrl: creatorProfiles.avatarUrl,
      tier: creatorStats.tier,
      avgRating: creatorStats.avgRating,
      recipeSalesCount: creatorStats.recipeSalesCount,
      favoriteCount: creatorStats.favoriteCount,
    })
    .from(creatorProfiles)
    .innerJoin(creatorStats, eq(creatorProfiles.userId, creatorStats.userId))
    .where(eq(creatorProfiles.isActive, true));

  const topCreators = rows.filter((r) => Number(r.avgRating) >= 4.5);
  const popularRecipes = rows.filter((r) => r.recipeSalesCount >= 50);
  const favorites = rows.filter((r) => r.favoriteCount >= 20);

  return { topCreators, popularRecipes, favorites };
}

function AwardCreatorCard({ creator }: { creator: AwardCreator }) {
  const badge = tierBadge[creator.tier];
  const initials = creator.displayName.slice(0, 2);

  return (
    <Link
      href={`/creators/${creator.creatorIdSlug}`}
      className="border border-gray-200 p-4 flex items-center gap-3 hover:border-black transition min-w-[200px] shrink-0"
    >
      <div
        className="w-10 h-10 bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0"
        style={{ borderRadius: "50%" }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-black truncate">
          {creator.displayName}
        </p>
        <span className={`inline-block text-xs px-2 py-0.5 ${badge.className}`}>
          {badge.label}
        </span>
      </div>
    </Link>
  );
}

export default async function AwardsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { topCreators, popularRecipes, favorites } = await getAwardCreators();

  const sections = [
    {
      title: "トップクリエイター",
      subtitle: "平均評価 4.5 以上のクリエイター",
      icon: "star",
      iconColor: "text-amber-500",
      items: topCreators,
    },
    {
      title: "人気レシピ",
      subtitle: "販売数 50 以上のクリエイター",
      icon: "trending_up",
      iconColor: "text-green-600",
      items: popularRecipes,
    },
    {
      title: "みんなのお気に入り",
      subtitle: "お気に入り登録 20 以上のクリエイター",
      icon: "favorite",
      iconColor: "text-pink-500",
      items: favorites,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          アワード
        </h1>
        <p className="text-sm text-gray-400">優秀なクリエイターを表彰</p>
      </div>

      <div className="space-y-10">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-medium text-black mb-1 flex items-center gap-1">
              <span
                className={`material-symbols-outlined text-base ${section.iconColor}`}
              >
                {section.icon}
              </span>
              {section.title}
            </h2>
            <p className="text-xs text-gray-400 mb-4">{section.subtitle}</p>

            {section.items.length === 0 ? (
              <div className="border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">
                  該当するクリエイターはまだいません
                </p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {section.items.map((creator) => (
                  <AwardCreatorCard key={creator.userId} creator={creator} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
