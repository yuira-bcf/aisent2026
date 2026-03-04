import {
  type CreatorListItem,
  getActiveCreators,
  getLatestRecipeForCreators,
  getPickupCreators,
} from "@/lib/services/creator-profile-service";
import type { Tier } from "@kyarainnovate/db/schema";
import Link from "next/link";
import { Suspense } from "react";
import CreatorsFilter from "./creators-filter";

export const revalidate = 60;

const tierConfig: Record<
  Tier,
  {
    label: string;
    short: string;
    color: string;
    bgGradient: string;
    borderColor: string;
  }
> = {
  APPRENTICE: {
    label: "Apprentice",
    short: "Apprentice",
    color: "#737373",
    bgGradient: "linear-gradient(135deg,#f5f5f5,#e5e5e5)",
    borderColor: "#d4d4d4",
  },
  ARTISAN: {
    label: "Artisan",
    short: "Artisan",
    color: "#92400e",
    bgGradient: "linear-gradient(135deg,#fefce8,#fef3c7)",
    borderColor: "#fde68a",
  },
  EXPERT: {
    label: "Expert",
    short: "Expert",
    color: "#64748b",
    bgGradient: "linear-gradient(135deg,#f8fafc,#f1f5f9)",
    borderColor: "#cbd5e1",
  },
  MASTER: {
    label: "Master",
    short: "Master",
    color: "#b45309",
    bgGradient: "linear-gradient(135deg,#fffbeb,#fef3c7)",
    borderColor: "#fde68a",
  },
  GRAND_MASTER: {
    label: "Grand Master",
    short: "GM",
    color: "#6d28d9",
    bgGradient: "linear-gradient(135deg,#f5f3ff,#ede9fe)",
    borderColor: "#c4b5fd",
  },
};

const tierDiamondColor: Record<Tier, string> = {
  APPRENTICE: "#a3a3a3",
  ARTISAN: "#cd7f32",
  EXPERT: "#94a3b8",
  MASTER: "#d97706",
  GRAND_MASTER: "#7c3aed",
};

const coverGradients = [
  "linear-gradient(135deg,#e8f5e9 0%,#f1f8e9 50%,#fff8e1 100%)",
  "linear-gradient(135deg,#e3f2fd 0%,#e8eaf6 50%,#ede7f6 100%)",
  "linear-gradient(135deg,#fce4ec 0%,#f3e5f5 50%,#e8eaf6 100%)",
  "linear-gradient(135deg,#fff3e0 0%,#fbe9e7 50%,#efebe9 100%)",
  "linear-gradient(135deg,#e0f7fa 0%,#e0f2f1 50%,#e8f5e9 100%)",
  "linear-gradient(135deg,#ede7f6 0%,#e8eaf6 50%,#e3f2fd 100%)",
];

import { SERIES_COLORS } from "@/lib/colors";

const radarColors = SERIES_COLORS;

function CreatorCard({
  creator,
  latestRecipe,
  index,
}: {
  creator: CreatorListItem & { styleDescription?: string | null };
  latestRecipe?: string;
  index: number;
}) {
  const tc = tierConfig[creator.tier];
  const initials = creator.displayName.slice(0, 2);
  const rating = Number(creator.avgRating);
  const coverBg = coverGradients[index % coverGradients.length];
  const diamondColor = tierDiamondColor[creator.tier];
  const radarColor = radarColors[index % radarColors.length];
  const isGM = creator.tier === "GRAND_MASTER";

  // Simple radar points based on index for visual variety
  const radarShapes = [
    "50,18 82,38 78,78 50,88 22,72 18,35",
    "50,22 85,40 72,82 50,85 28,70 25,32",
    "50,15 88,42 68,85 50,90 18,78 22,30",
    "50,20 80,30 88,72 50,82 20,78 15,40",
    "50,15 78,38 65,80 50,82 30,65 25,28",
    "50,18 75,32 85,75 50,88 22,80 20,38",
  ];
  const radarPoints = radarShapes[index % radarShapes.length];
  const radarPointsParsed = radarPoints
    .split(" ")
    .map((p) => p.split(",").map(Number));

  return (
    <Link
      href={`/creators/${creator.creatorIdSlug}`}
      className={`rounded bg-white overflow-hidden hover:shadow-sm transition cursor-pointer group ${
        isGM ? "border-[1.5px]" : "border border-gray-100"
      }`}
      style={isGM ? { borderColor: "#c4b5fd" } : undefined}
    >
      {/* Cover gradient */}
      <div className="h-16 relative" style={{ background: coverBg }}>
        <div className="absolute -bottom-5 left-3">
          <div
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-lg"
            style={{
              border: `2.5px solid ${diamondColor}`,
              ...(isGM ? { boxShadow: "0 0 8px rgba(124,58,237,0.3)" } : {}),
            }}
          >
            {initials}
          </div>
        </div>
        {/* Tier badge on cover */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded shadow-sm"
          style={{
            background: tc.bgGradient,
            border: `1px solid ${tc.borderColor}`,
          }}
        >
          <span
            style={{ color: diamondColor, fontSize: "11px", lineHeight: 1 }}
          >
            {creator.tier === "APPRENTICE" ? "\u25C7" : "\u25C6"}
          </span>
          <span className="text-[10px] font-bold" style={{ color: tc.color }}>
            {tc.label}
          </span>
        </div>
      </div>

      <div className="px-3 pt-7 pb-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[13px] font-bold text-black">
            {creator.displayName}
          </p>
          <span className="text-[8px] text-green-600 bg-green-50 px-1 rounded-full">
            &#10003;
          </span>
        </div>
        {creator.styleDescription && (
          <p className="text-[9px] text-gray-400 mb-2 line-clamp-1">
            &laquo;{creator.styleDescription}&raquo;
          </p>
        )}

        {/* Tag chips */}
        {creator.specialties && creator.specialties.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {creator.specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded bg-gray-50 text-[8px] text-gray-500"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-500">
          {rating > 0 && (
            <span>
              &#9733; <b className="text-amber-500">{rating.toFixed(1)}</b>
            </span>
          )}
          <span>
            &#9829; <b className="text-pink-400">{creator.favoriteCount}</b>
          </span>
          <span>
            調合 <b className="text-black">{creator.recipeSalesCount}</b>
          </span>
        </div>

        {/* Mini radar SVG */}
        <div className="flex items-center gap-3 mb-2">
          <svg
            width="48"
            height="48"
            viewBox="0 0 100 100"
            className="shrink-0"
            aria-hidden="true"
          >
            <title>スキルレーダー</title>
            <polygon
              points="50,10 90,35 90,75 50,95 10,75 10,35"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <polygon
              points="50,30 70,42 70,68 50,78 30,68 30,42"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="0.5"
            />
            <polygon
              points={radarPoints}
              fill={`${radarColor}1f`}
              stroke={radarColor}
              strokeWidth="1.5"
            />
            {radarPointsParsed.map(([cx, cy], i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static radar points
              <circle key={i} cx={cx} cy={cy} r="2" fill={radarColor} />
            ))}
          </svg>
          <div className="text-[8px] text-gray-400 leading-relaxed">
            {creator.specialties?.slice(0, 3).map((s, i) => (
              <div key={s}>
                {s} {"█".repeat(5 - i)}
                {"░".repeat(i)}
              </div>
            ))}
          </div>
        </div>

        {/* Best work */}
        {latestRecipe && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded mb-2">
            <div
              className="w-7 h-7 rounded-full shrink-0"
              style={{
                background: `conic-gradient(${radarColor} 0% 35%, #a78bfa 35% 55%, #86efac 55% 75%, #fde68a 75% 100%)`,
              }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-black truncate">
                {latestRecipe}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full py-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition"
        >
          この人で調合する
        </button>
      </div>
    </Link>
  );
}

type SortBy = "popular" | "newest" | "rating";

function buildPaginationUrl(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const str = qs.toString();
  return `/creators${str ? `?${str}` : ""}`;
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    page?: string;
    search?: string;
    specialty?: string;
    tier?: string;
  }>;
}) {
  const params = await searchParams;
  const sortParam = (params.sort ?? "popular") as SortBy;
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 12;
  const search = params.search ?? "";
  const specialty = params.specialty ?? "";
  const tier = params.tier ?? "";

  const sortByMap: Record<SortBy, "newest" | "rating" | "sales" | undefined> = {
    popular: undefined,
    newest: "newest",
    rating: "rating",
  };

  const [{ items, total }, pickupCreators] = await Promise.all([
    getActiveCreators(page, limit, {
      sortBy: sortByMap[sortParam],
      search: search || undefined,
      specialty: specialty || undefined,
      tier: tier || undefined,
    }),
    page === 1 && !search && !specialty && !tier
      ? getPickupCreators()
      : Promise.resolve([]),
  ]);

  const creatorUserIds = items.map((c) => c.userId);
  const latestRecipeMap = await getLatestRecipeForCreators(creatorUserIds);

  const sortOptions: { key: SortBy; label: string }[] = [
    { key: "popular", label: "人気順" },
    { key: "newest", label: "新着順" },
    { key: "rating", label: "評価順" },
  ];

  const paginationBase = {
    sort: sortParam !== "popular" ? sortParam : undefined,
    search: search || undefined,
    specialty: specialty || undefined,
    tier: tier || undefined,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar: Title + Search + Filters */}
        <div className="shrink-0 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-black">クリエーター</h1>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {total}名のクリエーターが活動中
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 text-[11px] text-gray-500 hover:border-black hover:text-black transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <title>比較モード</title>
                  <rect x="3" y="3" width="7" height="18" rx="1" />
                  <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>
                比較モード
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 text-[11px] text-gray-500 hover:border-black hover:text-black transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <title>マップで探す</title>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                マップで探す
              </button>
            </div>
          </div>
          {/* Search + Filter dropdowns */}
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <CreatorsFilter />
            </Suspense>
            <div className="flex items-center gap-2 shrink-0">
              {sortOptions.map((opt) => (
                <Link
                  key={opt.key}
                  href={buildPaginationUrl({
                    ...paginationBase,
                    sort: opt.key !== "popular" ? opt.key : undefined,
                  })}
                  className={`px-3 py-1.5 text-[11px] rounded transition ${
                    sortParam === opt.key
                      ? "bg-black text-white"
                      : "border border-gray-200 text-gray-500 hover:border-black"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Main: Left sidebar + Right grid */}
        <div className="flex-1 flex gap-4 min-h-0 pt-4 overflow-hidden">
          {/* Left Sidebar: Pickup + Map Preview */}
          <div className="w-[280px] shrink-0 flex-col gap-4 overflow-y-auto hidden lg:flex">
            {/* Pickup: Featured Creator */}
            {pickupCreators.length > 0 && (
              <div className="rounded overflow-hidden border border-gray-100 bg-white mb-4">
                <div className="px-3 py-2 bg-black text-white text-[10px] font-medium flex items-center gap-1.5">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <title>おすすめ</title>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  PICK UP — 今週のおすすめ
                </div>
                {pickupCreators.slice(0, 1).map((creator) => {
                  const tc = tierConfig[creator.tier];
                  const diamondColor = tierDiamondColor[creator.tier];
                  const rating = Number(creator.avgRating);
                  return (
                    <div
                      key={creator.id}
                      style={{
                        background:
                          "linear-gradient(135deg,#fce4ec 0%,#f3e5f5 50%,#e8eaf6 100%)",
                        padding: "16px",
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-2xl border-2 border-white shrink-0">
                          {creator.displayName.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-black">
                              {creator.displayName}
                            </p>
                            <span className="inline-flex items-center px-1 py-0.5 rounded-full bg-green-100 text-green-700 text-[8px] font-medium">
                              &#10003;
                            </span>
                            <span
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-bold shadow-sm"
                              style={{
                                background: tc.bgGradient,
                                color: tc.color,
                                border: `1px solid ${tc.borderColor}`,
                              }}
                            >
                              <span
                                style={{
                                  color: diamondColor,
                                  fontSize: "11px",
                                }}
                              >
                                &#9670;
                              </span>{" "}
                              {tc.label}
                            </span>
                          </div>
                          {creator.styleDescription && (
                            <p className="text-[10px] text-gray-600 mt-0.5">
                              &laquo;{creator.styleDescription}&raquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                        <div>
                          <p className="text-sm font-bold text-black">
                            {creator.recipeSalesCount}
                          </p>
                          <p className="text-[8px] text-gray-400">調合数</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-pink-500">
                            {creator.favoriteCount}
                          </p>
                          <p className="text-[8px] text-gray-400">&#9829;</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-500">
                            {rating > 0 ? rating.toFixed(1) : "-"}
                          </p>
                          <p className="text-[8px] text-gray-400">&#9733;</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-600">
                            -
                          </p>
                          <p className="text-[8px] text-gray-400">リピート</p>
                        </div>
                      </div>
                      {creator.latestRecipeName && (
                        <div className="bg-white/60 rounded p-2 mb-3">
                          <p className="text-[9px] text-gray-400 mb-1">
                            代表作
                          </p>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full shrink-0"
                              style={{
                                background:
                                  "conic-gradient(#f9a8d4 0% 35%,#a78bfa 35% 55%,#86efac 55% 75%,#fde68a 75% 100%)",
                              }}
                            />
                            <div>
                              <p className="text-[11px] font-medium text-black">
                                {creator.latestRecipeName}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <Link
                        href={`/creators/${creator.creatorIdSlug}`}
                        className="btn-primary w-full py-2 text-xs block text-center"
                      >
                        プロフィールを見る
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Map Preview */}
            <div className="rounded border border-gray-100 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-50 text-[11px] font-medium text-black flex items-center gap-1.5">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <title>分布マップ</title>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                クリエーター分布マップ
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-square bg-gray-50 rounded overflow-hidden mb-2">
                  <span className="absolute top-1 left-1 text-[7px] text-gray-300">
                    フレッシュ×フローラル
                  </span>
                  <span className="absolute top-1 right-1 text-[7px] text-gray-300">
                    ウォーム×フローラル
                  </span>
                  <span className="absolute bottom-1 left-1 text-[7px] text-gray-300">
                    フレッシュ×ウッディ
                  </span>
                  <span className="absolute bottom-1 right-1 text-[7px] text-gray-300">
                    ウォーム×ウッディ
                  </span>
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />
                  <div
                    className="absolute w-3 h-3 rounded-full bg-pink-400 border border-white shadow-sm"
                    style={{ left: "30%", top: "25%" }}
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full bg-emerald-400 border border-white shadow-sm"
                    style={{ left: "35%", top: "40%" }}
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full bg-blue-400 border border-white shadow-sm"
                    style={{ left: "60%", top: "65%" }}
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full bg-amber-400 border border-white shadow-sm"
                    style={{ left: "70%", top: "30%" }}
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full bg-purple-400 border border-white shadow-sm"
                    style={{ left: "20%", top: "70%" }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-gray-300 border border-white"
                    style={{ left: "45%", top: "55%" }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 text-center">
                  得意エリアでクリエーターを探す
                </p>
                <button
                  type="button"
                  className="w-full mt-2 py-1.5 rounded border border-gray-200 text-[10px] text-gray-500 hover:border-black hover:text-black transition"
                >
                  マップを拡大して探索 →
                </button>
              </div>
            </div>
          </div>

          {/* Right: Creator Card Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {items.length === 0 ? (
              <div className="card p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
                  person_search
                </span>
                <p className="text-sm text-gray-400">
                  クリエイターが見つかりません
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((creator, idx) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    latestRecipe={latestRecipeMap[creator.userId]}
                    index={idx}
                  />
                ))}
              </div>
            )}

            {total > limit && (
              <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                {page > 1 && (
                  <Link
                    href={buildPaginationUrl({
                      ...paginationBase,
                      page: String(page - 1),
                    })}
                    className="px-3 py-1.5 text-xs border border-gray-200 hover:border-black transition rounded"
                  >
                    前へ
                  </Link>
                )}
                <span className="text-xs text-gray-400">
                  {page} / {Math.ceil(total / limit)}
                </span>
                {page < Math.ceil(total / limit) && (
                  <Link
                    href={buildPaginationUrl({
                      ...paginationBase,
                      page: String(page + 1),
                    })}
                    className="px-3 py-1.5 text-xs border border-gray-200 hover:border-black transition rounded"
                  >
                    次へ
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
