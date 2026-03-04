"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SEASONS = [
  { key: "春", label: "🌸 春" },
  { key: "夏", label: "☀️ 夏" },
  { key: "秋", label: "🍂 秋" },
  { key: "冬", label: "❄️ 冬" },
] as const;

const MOODS = [
  "明るい",
  "落ち着いた",
  "情熱的",
  "ミステリアス",
  "清潔感",
] as const;

const STATUSES = [
  { key: "COMPLETED", label: "完了" },
  { key: "PROCESSING", label: "注文済み" },
  { key: "PENDING", label: "下書き" },
] as const;

export default function HistoryFilter({
  totalPages,
  totalCount,
  currentPageSize,
  pageStart,
  pageEnd,
}: {
  totalPages: number;
  totalCount: number;
  currentPageSize: number;
  pageStart: number;
  pageEnd: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const currentSeason = searchParams.get("season") ?? "";
  const currentMood = searchParams.get("mood") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchValue, setSearchValue] = useState(currentSearch);

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return `/history${qs ? `?${qs}` : ""}`;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ search: searchValue || null, page: null }));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      router.push(buildUrl({ search: searchValue || null, page: null }));
    }
  }

  function handleSeasonChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(buildUrl({ season: val || null, page: null }));
  }

  function handleMoodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(buildUrl({ mood: val || null, page: null }));
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(buildUrl({ status: val || null, page: null }));
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(buildUrl({ sort: val === "newest" ? null : val, page: null }));
  }

  function handlePageChange(page: number) {
    router.push(buildUrl({ page: page > 1 ? String(page) : null }));
  }

  function clearFilter(key: string) {
    router.push(buildUrl({ [key]: null, page: null }));
  }

  function clearAllFilters() {
    router.push(
      buildUrl({
        search: null,
        season: null,
        mood: null,
        status: null,
        page: null,
      }),
    );
  }

  const hasFilters =
    currentSearch || currentSeason || currentMood || currentStatus;

  const seasonLabel = SEASONS.find((s) => s.key === currentSeason)?.label;
  const statusLabel = STATUSES.find((s) => s.key === currentStatus)?.label;

  return (
    <>
      {/* Filter + Sort Bar */}
      <div className="card p-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <title>検索</title>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="名前で検索..."
              className="w-full border border-gray-200 pl-8 pr-3 py-2 text-xs focus:border-black focus:outline-none rounded"
            />
          </form>
          <div className="h-5 w-px bg-gray-200" />
          {/* Filters */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">フィルター:</span>
            <select
              value={currentSeason}
              onChange={handleSeasonChange}
              className="border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none rounded bg-white"
            >
              <option value="">全ての季節</option>
              {SEASONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={currentMood}
              onChange={handleMoodChange}
              className="border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none rounded bg-white"
            >
              <option value="">全てのムード</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              className="border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none rounded bg-white"
            >
              <option value="">全てのステータス</option>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="h-5 w-px bg-gray-200" />
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">並替:</span>
            <select
              value={currentSort}
              onChange={handleSortChange}
              className="border border-gray-200 px-2 py-1.5 text-[11px] focus:border-black focus:outline-none rounded bg-white"
            >
              <option value="newest">作成日 ↓ 新しい順</option>
              <option value="oldest">作成日 ↑ 古い順</option>
              <option value="name_asc">名前 A→Z</option>
              <option value="name_desc">名前 Z→A</option>
            </select>
          </div>
        </div>
        {/* Active Filters */}
        {hasFilters && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
            <span className="text-[10px] text-gray-300">適用中:</span>
            {currentSearch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px]">
                &quot;{currentSearch}&quot;{" "}
                <button
                  type="button"
                  onClick={() => clearFilter("search")}
                  className="ml-0.5 hover:text-gray-300"
                >
                  ✕
                </button>
              </span>
            )}
            {currentSeason && seasonLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px]">
                {seasonLabel}{" "}
                <button
                  type="button"
                  onClick={() => clearFilter("season")}
                  className="ml-0.5 hover:text-gray-300"
                >
                  ✕
                </button>
              </span>
            )}
            {currentMood && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px]">
                {currentMood}{" "}
                <button
                  type="button"
                  onClick={() => clearFilter("mood")}
                  className="ml-0.5 hover:text-gray-300"
                >
                  ✕
                </button>
              </span>
            )}
            {currentStatus && statusLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px]">
                {statusLabel}{" "}
                <button
                  type="button"
                  onClick={() => clearFilter("status")}
                  className="ml-0.5 hover:text-gray-300"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[10px] text-gray-400 hover:text-black underline"
            >
              クリア
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-gray-400">
            {pageStart}〜{pageEnd} 件 / 全 {totalCount} 件
            {hasFilters ? "（フィルター適用中）" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 text-gray-300 rounded text-xs disabled:opacity-50"
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
                <title>前のページ</title>
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-medium ${
                  p === currentPage
                    ? "bg-black text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 text-gray-600 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
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
                <title>次のページ</title>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">表示件数:</span>
            <select className="border border-gray-200 px-2 py-1 text-[11px] focus:border-black focus:outline-none rounded bg-white">
              <option>{currentPageSize}件</option>
            </select>
          </div>
        </div>
      )}
    </>
  );
}
