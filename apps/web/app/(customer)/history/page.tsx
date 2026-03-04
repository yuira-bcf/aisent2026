import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  blendRequestKeywords,
  blendRequests,
  keywords,
} from "@kyarainnovate/db/schema";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import HistoryFilter from "./history-filter";

const PAGE_SIZE = 5;

function computeVersionNumber(
  parentBlendId: string | null,
  versionMap: Map<string, number>,
): number {
  if (!parentBlendId) return 1;
  return (versionMap.get(parentBlendId) ?? 1) + 1;
}

function computeSimilarity(
  currentKeywords: string[],
  parentKeywords: string[],
): number {
  if (parentKeywords.length === 0 && currentKeywords.length === 0) return 100;
  const all = new Set([...currentKeywords, ...parentKeywords]);
  if (all.size === 0) return 100;
  const common = currentKeywords.filter((k) => parentKeywords.includes(k));
  return Math.round((common.length / all.size) * 100);
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "下書き",
  PROCESSING: "注文済",
  COMPLETED: "完了",
  FAILED: "失敗",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-600",
  PROCESSING: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
};

import { noteConicGradient } from "@/lib/colors";

// Simple hash-based conic-gradient for mini donut
function generateConicGradient(
  topRatio: number,
  middleRatio: number,
  lastRatio: number,
): string {
  return noteConicGradient(topRatio, middleRatio, lastRatio);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    season?: string;
    mood?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const search = params.search ?? "";
  const season = params.season ?? "";
  const mood = params.mood ?? "";
  const status = params.status ?? "";
  const sort = params.sort ?? "newest";
  const page = Math.max(1, Number(params.page) || 1);

  // Build conditions
  const conditions = [eq(blendRequests.userId, session.user.id)];

  if (search) {
    conditions.push(ilike(blendRequests.name, `%${search}%`));
  }

  if (season) {
    conditions.push(
      sql`${blendRequests.id} IN (
        SELECT brk.blend_request_id FROM blend_request_keywords brk
        JOIN keywords kw ON kw.id = brk.keyword_id
        WHERE kw.word ILIKE ${`%${season}%`}
      )`,
    );
  }

  if (mood) {
    conditions.push(
      sql`${blendRequests.id} IN (
        SELECT brk.blend_request_id FROM blend_request_keywords brk
        JOIN keywords kw ON kw.id = brk.keyword_id
        WHERE kw.word ILIKE ${`%${mood}%`}
      )`,
    );
  }

  if (status) {
    conditions.push(
      eq(
        blendRequests.status,
        status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
      ),
    );
  }

  const where = and(...conditions);

  // Count total
  const [{ count: total }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(blendRequests)
    .where(where);

  const totalCount = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  const orderBy =
    sort === "oldest"
      ? asc(blendRequests.createdAt)
      : desc(blendRequests.createdAt);

  // Fetch paginated results
  const history = await db.query.blendRequests.findMany({
    where,
    orderBy,
    limit: PAGE_SIZE,
    offset,
    with: {
      keywords: {
        with: { keyword: true },
      },
    },
  });

  // Build version map & fetch parent keywords for similarity
  const versionMap = new Map<string, number>();
  const parentIds = history
    .map((h) => h.parentBlendId)
    .filter((id): id is string => id != null);

  const parentKeywordsMap = new Map<string, string[]>();
  if (parentIds.length > 0) {
    const parentBlends = await db.query.blendRequests.findMany({
      where: and(
        sql`${blendRequests.id} IN (${sql.join(
          parentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        eq(blendRequests.userId, session.user.id),
      ),
      with: {
        keywords: {
          with: { keyword: true },
        },
      },
    });
    for (const pb of parentBlends) {
      parentKeywordsMap.set(
        pb.id,
        pb.keywords.map((k) => k.keyword.word),
      );
      // Simple version assignment: parent is v1 if no grandparent
      versionMap.set(pb.id, pb.parentBlendId ? 2 : 1);
    }
  }

  // Compute version numbers for current items
  const itemVersions = new Map<string, number>();
  for (const item of history) {
    if (item.parentBlendId) {
      itemVersions.set(
        item.id,
        computeVersionNumber(item.parentBlendId, versionMap),
      );
    }
  }

  const hasFilters = search || season || mood || status;
  const pageStart = offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, totalCount);

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-black">調合履歴</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">全 {totalCount} 件</p>
        </div>
        <Link href="/blend" className="btn-primary px-4 py-2 text-xs rounded">
          + 新しい調合
        </Link>
      </div>

      <Suspense fallback={null}>
        <HistoryFilter
          totalPages={totalPages}
          totalCount={totalCount}
          currentPageSize={PAGE_SIZE}
          pageStart={pageStart}
          pageEnd={pageEnd}
        />
      </Suspense>

      {history.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-gray-400">
            {hasFilters
              ? "条件に一致する履歴がありません"
              : "まだ調合履歴がありません"}
          </p>
          {!hasFilters && (
            <Link
              href="/blend"
              className="inline-block mt-4 text-sm text-black underline"
            >
              最初の調合を試す
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {history.map((item) => {
            const version = itemVersions.get(item.id);
            const currentKws = item.keywords.map((k) => k.keyword.word);
            const parentKws = item.parentBlendId
              ? parentKeywordsMap.get(item.parentBlendId)
              : undefined;
            const similarity =
              parentKws !== undefined
                ? computeSimilarity(currentKws, parentKws)
                : undefined;

            const topRatio = Number(item.topRatio) || 33;
            const middleRatio = Number(item.middleRatio) || 34;
            const lastRatio = Number(item.lastRatio) || 33;

            const createdAt = new Date(item.createdAt);
            const dateStr = createdAt.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            const timeStr = createdAt.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

            // Extract season/mood from keywords for metadata display
            const seasonKw = currentKws.find((k) =>
              ["春", "夏", "秋", "冬"].some((s) => k.includes(s)),
            );
            const moodKw = currentKws.find(
              (k) => !["春", "夏", "秋", "冬"].some((s) => k.includes(s)),
            );

            return (
              <Link
                key={item.id}
                href={`/result/${item.id}`}
                className="card p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors block"
              >
                {/* Mini Donut */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: generateConicGradient(
                      topRatio,
                      middleRatio,
                      lastRatio,
                    ),
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-white" />
                </div>

                {/* Name + Keywords */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-black truncate">
                      {item.name ?? "無題のフレグランス"}
                    </p>
                    {version && (
                      <span
                        className={`badge ${version >= 2 ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                      >
                        v{version}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {[seasonKw, moodKw].filter(Boolean).join(" ・ ")}
                  </p>
                </div>

                {/* Right side: date, status, similarity, arrow */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">{dateStr}</p>
                    <p className="text-[9px] text-gray-300">{timeStr}</p>
                  </div>
                  <span
                    className={`badge ${STATUS_BADGE[item.status] ?? "bg-gray-100 text-gray-500"}`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  {similarity !== undefined ? (
                    <span className="text-[10px] text-gray-400">
                      {similarity}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">--</span>
                  )}
                  <svg
                    className="text-gray-300"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <title>詳細を見る</title>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
