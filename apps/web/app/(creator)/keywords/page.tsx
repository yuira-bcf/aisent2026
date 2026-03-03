import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keywordFlavorRules, keywords } from "@kyarainnovate/db/schema";
import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import KeywordsFilter from "./keywords-filter";

export default async function KeywordsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const filter = params.filter ?? "all";

  // Get all keywords with rule counts
  const allKeywords = await db
    .select({
      id: keywords.id,
      word: keywords.word,
      category: keywords.category,
      isPreset: keywords.isPreset,
      usageCount: keywords.usageCount,
      ruleCount: sql<number>`(
        SELECT COUNT(*) FROM keyword_flavor_rules
        WHERE keyword_flavor_rules.keyword_id = ${keywords.id}
      )`.as("rule_count"),
    })
    .from(keywords)
    .orderBy(desc(keywords.usageCount));

  // Apply client-side-like filter at server level
  const filteredKeywords = allKeywords.filter((kw) => {
    const hasRules = Number(kw.ruleCount) > 0;
    if (filter === "undefined") return !hasRules;
    if (filter === "defined") return hasRules;
    return true;
  });

  const totalKeywords = allKeywords.length;
  const withRules = allKeywords.filter((k) => Number(k.ruleCount) > 0).length;
  const coverage =
    totalKeywords > 0 ? ((withRules / totalKeywords) * 100).toFixed(1) : "0";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">
            クリエータールール管理
          </h1>
          <p className="text-sm text-gray-400">{totalKeywords}件</p>
        </div>
        <Link
          href="/stats"
          className="text-sm text-gray-400 hover:text-black transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base text-indigo-400">
            bar_chart
          </span>
          統計を見る
        </Link>
      </div>

      {/* Summary */}
      <div className="border border-gray-200 p-4 mb-6 flex items-center justify-between text-sm">
        <span>
          カバレッジ: {coverage}% ({withRules}/{totalKeywords})
        </span>
        {totalKeywords - withRules > 0 && (
          <span className="text-gray-400">
            未定義: {totalKeywords - withRules}件
          </span>
        )}
      </div>

      {/* Filter */}
      <Suspense fallback={null}>
        <KeywordsFilter />
      </Suspense>

      {/* Keyword list */}
      <div className="space-y-2">
        {filteredKeywords.length === 0 ? (
          <div className="border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">
              条件に一致するキーワードがありません
            </p>
          </div>
        ) : (
          filteredKeywords.map((kw) => {
            const hasRules = Number(kw.ruleCount) > 0;
            return (
              <Link
                key={kw.id}
                href={`/keywords/${kw.id}`}
                className="block border border-gray-200 p-4 hover:border-gray-400 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasRules ? "bg-black" : "bg-red-400"
                      }`}
                    />
                    <span className="text-sm font-medium">{kw.word}</span>
                    <span className="text-xs text-gray-300">{kw.category}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>使用: {kw.usageCount}回</span>
                    <span>ルール: {kw.ruleCount}件</span>
                    <span className="material-symbols-outlined text-base">
                      chevron_right
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
