import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordFlavorRules, keywords } from "@kyarainnovate/db/schema";
import { count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function StatsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Total keywords
  const [{ total: totalKeywords }] = await db
    .select({ total: count() })
    .from(keywords);

  // Keywords with rules (by this creator)
  const [{ total: keywordsWithRules }] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${keywordFlavorRules.keywordId})`,
    })
    .from(keywordFlavorRules)
    .where(eq(keywordFlavorRules.creatorId, session.user.id));

  // Total rules by this creator
  const [{ total: totalRules }] = await db
    .select({ total: count() })
    .from(keywordFlavorRules)
    .where(eq(keywordFlavorRules.creatorId, session.user.id));

  const coveragePercent =
    totalKeywords > 0
      ? ((Number(keywordsWithRules) / totalKeywords) * 100).toFixed(1)
      : "0";

  const stats = [
    {
      label: "キーワード総数",
      value: totalKeywords,
      icon: "label",
      color: "text-amber-500",
    },
    {
      label: "ルール定義済み",
      value: keywordsWithRules,
      icon: "check_circle",
      color: "text-emerald-500",
    },
    {
      label: "ルール総数",
      value: totalRules,
      icon: "tune",
      color: "text-indigo-500",
    },
    {
      label: "カバレッジ",
      value: `${coveragePercent}%`,
      icon: "pie_chart",
      color: "text-rose-500",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            統計
          </h1>
          <p className="text-sm text-gray-400">ルール定義の状況</p>
        </div>
        <Link
          href="/keywords"
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base text-indigo-400">
            list
          </span>
          キーワード一覧
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
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
    </div>
  );
}
