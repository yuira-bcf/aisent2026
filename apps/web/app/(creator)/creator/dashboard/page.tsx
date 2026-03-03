import { auth } from "@/lib/auth";
import { getCreatorDetail } from "@/lib/services/creator-profile-service";
import Link from "next/link";
import { redirect } from "next/navigation";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  APPRENTICE: { label: "APPRENTICE", color: "bg-gray-100 text-gray-600" },
  ARTISAN: { label: "ARTISAN", color: "bg-blue-50 text-blue-700" },
  EXPERT: { label: "EXPERT", color: "bg-purple-50 text-purple-700" },
  MASTER: { label: "MASTER", color: "bg-amber-50 text-amber-700" },
  GRAND_MASTER: { label: "GRAND MASTER", color: "bg-red-50 text-red-700" },
};

const TIER_THRESHOLDS: Record<string, { min: number; max: number }> = {
  APPRENTICE: { min: 0, max: 30 },
  ARTISAN: { min: 30, max: 55 },
  EXPERT: { min: 55, max: 75 },
  MASTER: { min: 75, max: 90 },
  GRAND_MASTER: { min: 90, max: 100 },
};

export default async function CreatorDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const detail = await getCreatorDetail(session.user.id);

  if (!detail) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          ダッシュボード
        </h1>
        <p className="text-sm text-gray-400">
          クリエータープロフィールが見つかりません。
        </p>
      </div>
    );
  }

  const stats = detail.stats;
  const tier = stats?.tier ?? "APPRENTICE";
  const tierScore = Number(stats?.tierScore ?? 0);
  const badge = TIER_BADGE[tier] ?? TIER_BADGE.APPRENTICE;
  const threshold = TIER_THRESHOLDS[tier] ?? TIER_THRESHOLDS.APPRENTICE;
  const progressPercent =
    threshold.max > threshold.min
      ? Math.min(
          ((tierScore - threshold.min) / (threshold.max - threshold.min)) * 100,
          100,
        )
      : 100;

  const statCards = [
    {
      label: "売上数",
      value: stats?.recipeSalesCount ?? 0,
      icon: "shopping_bag",
      color: "text-amber-500",
    },
    {
      label: "平均評価",
      value: Number(stats?.avgRating ?? 0).toFixed(1),
      icon: "star",
      color: "text-yellow-500",
    },
    {
      label: "お気に入り数",
      value: stats?.favoriteCount ?? 0,
      icon: "favorite",
      color: "text-rose-500",
    },
    {
      label: "リピート率",
      value: `${Number(stats?.repeatRate ?? 0).toFixed(1)}%`,
      icon: "refresh",
      color: "text-emerald-500",
    },
  ];

  const quickLinks = [
    { href: "/creator/settings", label: "設定", icon: "settings" },
    { href: "/keywords", label: "キーワード", icon: "label" },
    { href: "/stats", label: "統計", icon: "bar_chart" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
          おかえりなさい、{detail.displayName}
        </h1>
        <p className="text-sm text-gray-400">クリエイターダッシュボード</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`material-symbols-outlined text-base ${stat.color}`}
              >
                {stat.icon}
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-black">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tier Progress */}
      <div className="border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wide block mb-1">
              現在のティア
            </span>
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 ${badge.color}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wide block mb-1">
              ティアスコア
            </span>
            <span className="text-lg font-bold text-black">
              {tierScore.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-2">
          <div
            className="bg-black h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{threshold.min}</span>
          <span className="text-xs text-gray-400">{threshold.max}</span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:border-black hover:text-black transition"
          >
            <span className="material-symbols-outlined text-base">
              {link.icon}
            </span>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
