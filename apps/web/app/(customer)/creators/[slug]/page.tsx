import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCreatorDetail } from "@/lib/services/creator-profile-service";
import { creatorFavorites, creatorProfiles } from "@kyarainnovate/db/schema";
import type { Tier } from "@kyarainnovate/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import CreatorRadar from "./creator-radar";
import FavoriteButton from "./favorite-button";
import { VisitTracker } from "./visit-tracker";

export const revalidate = 60;

const tierBadge: Record<Tier, { label: string; className: string }> = {
  APPRENTICE: { label: "Apprentice", className: "bg-gray-100 text-gray-600" },
  ARTISAN: { label: "Artisan", className: "bg-blue-50 text-blue-700" },
  EXPERT: { label: "Expert", className: "bg-purple-50 text-purple-700" },
  MASTER: { label: "Master", className: "bg-amber-50 text-amber-700" },
  GRAND_MASTER: { label: "Grand Master", className: "bg-red-50 text-red-700" },
};

function getAwardBadges(stats: {
  tier: Tier;
  avgRating: string;
  recipeSalesCount: number;
  favoriteCount: number;
}) {
  const badges: { icon: string; label: string; className: string }[] = [];

  // Tier badge
  const tb = tierBadge[stats.tier];
  badges.push({
    icon: "military_tech",
    label: tb.label,
    className: tb.className,
  });

  // High rating
  if (Number(stats.avgRating) >= 4.5) {
    badges.push({
      icon: "star",
      label: "高評価クリエイター",
      className: "bg-amber-50 text-amber-700",
    });
  }

  // Popular recipes
  if (stats.recipeSalesCount >= 100) {
    badges.push({
      icon: "trending_up",
      label: "人気レシピ達成",
      className: "bg-green-50 text-green-700",
    });
  }

  // Favorite creator
  if (stats.favoriteCount >= 50) {
    badges.push({
      icon: "favorite",
      label: "みんなのお気に入り",
      className: "bg-pink-50 text-pink-700",
    });
  }

  return badges;
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [profile] = await db
    .select({ userId: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.creatorIdSlug, slug));

  if (!profile) notFound();

  const detail = await getCreatorDetail(profile.userId);
  if (!detail) notFound();

  const session = await auth();

  let isFavorited = false;
  if (session) {
    const [fav] = await db
      .select({ id: creatorFavorites.id })
      .from(creatorFavorites)
      .where(
        and(
          eq(creatorFavorites.userId, session.user.id),
          eq(creatorFavorites.creatorId, detail.userId),
        ),
      );
    isFavorited = !!fav;
  }

  const badge = detail.stats
    ? tierBadge[detail.stats.tier]
    : tierBadge.APPRENTICE;
  const initials = detail.displayName.slice(0, 2);

  const statItems = [
    {
      label: "調合数",
      value: detail.publishedRecipeCount,
      color: "text-black",
    },
    {
      label: "お気に入り",
      value: detail.stats?.favoriteCount ?? 0,
      color: "text-pink-500",
    },
    {
      label: "平均評価",
      value: detail.stats
        ? `${Number(detail.stats.avgRating).toFixed(1)}`
        : "-",
      color: "text-amber-500",
    },
    {
      label: "販売数",
      value: detail.stats?.recipeSalesCount ?? 0,
      color: "text-emerald-600",
    },
  ];

  const awardBadges = detail.stats ? getAwardBadges(detail.stats) : [];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {session && <VisitTracker slug={slug} />}

      {/* Hero: Cover + Profile */}
      <div
        className="shrink-0 relative"
        style={{
          background:
            "linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 40%,#fff8e1 100%)",
          borderRadius: "0 0 4px 4px",
        }}
      >
        <div className="flex items-end gap-5 px-6 pt-5 pb-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-lg font-medium text-gray-600 shrink-0 border-2 border-white -mb-1">
            {initials}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-black">
                {detail.displayName}
              </h2>
              <span className="text-[10px] text-gray-400 font-mono">
                @{slug}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold shadow-sm ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            {detail.bio && (
              <p className="text-[11px] text-gray-500 mt-0.5">{detail.bio}</p>
            )}
            {detail.specialties && detail.specialties.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {detail.specialties.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] text-gray-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-5 shrink-0 text-center">
            {statItems.map((s) => (
              <div key={s.label}>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="h-8 w-px bg-gray-200/50 shrink-0" />
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {session && (
              <FavoriteButton
                creatorUserId={detail.userId}
                initialFavorited={isFavorited}
              />
            )}
          </div>
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="flex-1 grid grid-cols-3 gap-3 pt-3 px-3 min-h-0 pb-3">
        {/* Col 1: Award Badges + Specialties */}
        <div className="card p-3 flex flex-col min-h-0">
          <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-1.5 shrink-0">
            実績・スタイル
          </h3>

          {/* Style Description */}
          {detail.styleDescription && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-100">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                {detail.styleDescription}
              </p>
            </div>
          )}

          {/* Award Badges */}
          {awardBadges.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 mb-2">アワード</p>
              <div className="flex flex-wrap gap-1.5">
                {awardBadges.map((ab) => (
                  <span
                    key={ab.label}
                    className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 ${ab.className}`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {ab.icon}
                    </span>
                    {ab.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recipes list */}
          {detail.recipes.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto">
              <p className="text-[10px] text-gray-400 mb-2">公開レシピ</p>
              <div className="border border-gray-100 divide-y divide-gray-50">
                {detail.recipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition text-[11px]"
                  >
                    <div>
                      <p className="text-black font-medium">{recipe.name}</p>
                      <p className="text-[9px] text-gray-400">
                        注文数: {recipe.orderCount}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-sm text-gray-300">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Col 2: Radar Chart (full height) */}
        <div className="card p-3 flex flex-col min-h-0">
          <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2 shrink-0">
            調合スタイル
          </h3>
          {detail.specialties && detail.specialties.length > 0 ? (
            <div className="flex-1 min-h-0">
              <CreatorRadar specialties={detail.specialties} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[10px] text-gray-300">
              データなし
            </div>
          )}

          {/* Specialties as tags */}
          {detail.specialties && detail.specialties.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 shrink-0">
              <p className="text-[9px] text-gray-400 mb-1.5">得意ジャンル</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.specialties.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2.5 py-0.5 bg-gray-50 text-gray-600 border border-gray-100"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Col 3: CTA */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* About */}
          <div className="card p-3 flex-1 min-h-0 overflow-auto">
            <h3 className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              プロフィール
            </h3>
            {detail.bio && (
              <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
                {detail.bio}
              </p>
            )}
            {detail.styleDescription && (
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {detail.styleDescription}
              </p>
            )}
          </div>

          {/* Inline CTA */}
          <div className="card p-3 shrink-0 border-black border">
            <p className="text-[10px] text-gray-500 mb-2">
              {detail.displayName}に調合を依頼
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/blend?creator=${slug}`}
                className="flex-1 bg-black text-white text-center py-2 text-[11px] font-medium hover:bg-gray-800 transition"
              >
                このクリエイターで調合する
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
