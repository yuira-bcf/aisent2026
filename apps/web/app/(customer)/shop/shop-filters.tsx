"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterState = {
  q: string;
  season: string;
  scene: string;
  intensity: string;
  volume: string;
  minRating: string;
  priceMin: string;
  priceMax: string;
  inStock: boolean;
};

function parseFilters(sp: URLSearchParams): FilterState {
  return {
    q: sp.get("q") ?? "",
    season: sp.get("season") ?? "",
    scene: sp.get("scene") ?? "",
    intensity: sp.get("intensity") ?? "",
    volume: sp.get("volume") ?? "",
    minRating: sp.get("minRating") ?? "",
    priceMin: sp.get("priceMin") ?? "",
    priceMax: sp.get("priceMax") ?? "",
    inStock: sp.get("inStock") !== "false",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShopFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(
    parseFilters(searchParams),
  );

  const applyFilters = useCallback(
    (next: Partial<FilterState>) => {
      const merged = { ...filters, ...next };
      setFilters(merged);

      const params = new URLSearchParams(searchParams.toString());
      // Reset page on filter change
      params.delete("page");

      for (const [key, val] of Object.entries(merged)) {
        if (key === "inStock") {
          if (val === false) params.set("inStock", "false");
          else params.delete("inStock");
        } else if (val) {
          params.set(key, String(val));
        } else {
          params.delete(key);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [filters, pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    setFilters({
      q: "",
      season: "",
      scene: "",
      intensity: "",
      volume: "",
      minRating: "",
      priceMin: "",
      priceMax: "",
      inStock: true,
    });
    router.push(pathname);
  }, [pathname, router]);

  const seasons = ["春", "夏", "秋", "冬"];
  const volumes = ["10", "30", "50", "100"];
  const intensities = [
    { label: "ライト", value: "light" },
    { label: "ミディアム", value: "medium" },
    { label: "ストロング", value: "strong" },
  ];

  return (
    <div className="w-[200px] shrink-0 space-y-4 hidden md:block">
      {/* Search */}
      <div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[16px]">
            search
          </span>
          <input
            type="text"
            placeholder="商品名・説明で検索..."
            value={filters.q}
            onChange={(e) => {
              setFilters((f) => ({ ...f, q: e.target.value }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters({ q: filters.q });
            }}
            className="w-full border border-gray-200 pl-8 pr-3 py-2 text-[11px] focus:border-black focus:outline-none rounded"
          />
        </div>
      </div>

      {/* Volume */}
      <div>
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
          容量
        </p>
        <div className="flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => applyFilters({ volume: "" })}
            className={`px-2.5 py-1 text-[10px] rounded ${
              !filters.volume
                ? "bg-black text-white"
                : "border border-gray-200 text-gray-500 hover:border-black"
            }`}
          >
            ALL
          </button>
          {volumes.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                applyFilters({ volume: filters.volume === v ? "" : v })
              }
              className={`px-2.5 py-1 text-[10px] rounded ${
                filters.volume === v
                  ? "bg-black text-white"
                  : "border border-gray-200 text-gray-500 hover:border-black"
              }`}
            >
              {v}ml
            </button>
          ))}
        </div>
      </div>

      {/* Season */}
      <div>
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
          季節
        </p>
        <div className="flex gap-1 flex-wrap">
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                applyFilters({ season: filters.season === s ? "" : s })
              }
              className={`px-2 py-1 text-[10px] rounded ${
                filters.season === s
                  ? "bg-black text-white"
                  : "border border-gray-200 text-gray-500 hover:border-black"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Intensity */}
      <div>
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
          強さ
        </p>
        <div className="flex gap-1 flex-wrap">
          {intensities.map((i) => (
            <button
              key={i.value}
              type="button"
              onClick={() =>
                applyFilters({
                  intensity: filters.intensity === i.value ? "" : i.value,
                })
              }
              className={`px-2 py-1 text-[10px] rounded ${
                filters.intensity === i.value
                  ? "bg-black text-white"
                  : "border border-gray-200 text-gray-500 hover:border-black"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
          評価
        </p>
        <div className="space-y-0.5">
          {[
            { label: "★4.0 以上", value: "4" },
            { label: "★3.5 以上", value: "3.5" },
            { label: "すべて", value: "" },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer"
            >
              <input
                type="radio"
                name="rating"
                className="w-3 h-3 accent-black"
                checked={filters.minRating === opt.value}
                onChange={() => applyFilters({ minRating: opt.value })}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide mb-2">
          価格帯
        </p>
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="¥下限"
            value={filters.priceMin}
            onChange={(e) =>
              setFilters((f) => ({ ...f, priceMin: e.target.value }))
            }
            onBlur={() => applyFilters({ priceMin: filters.priceMin })}
            className="w-1/2 border border-gray-200 px-2 py-1 text-[10px] text-center rounded"
          />
          <span className="text-[10px] text-gray-300">—</span>
          <input
            type="number"
            placeholder="¥上限"
            value={filters.priceMax}
            onChange={(e) =>
              setFilters((f) => ({ ...f, priceMax: e.target.value }))
            }
            onBlur={() => applyFilters({ priceMax: filters.priceMax })}
            className="w-1/2 border border-gray-200 px-2 py-1 text-[10px] text-center rounded"
          />
        </div>
      </div>

      {/* In Stock Toggle */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => applyFilters({ inStock: !filters.inStock })}
          className="flex items-center justify-between text-[11px] text-gray-600 w-full"
        >
          在庫ありのみ
          <div
            className={`w-8 h-4 rounded-full relative transition ${filters.inStock ? "bg-black" : "bg-gray-300"}`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-sm transition ${filters.inStock ? "right-0.5" : "left-0.5"}`}
            />
          </div>
        </button>
      </div>

      {/* Result count */}
      <div className="text-[10px] text-gray-400">{total}件の商品</div>

      {/* Clear */}
      <button
        type="button"
        onClick={clearAll}
        className="w-full py-1.5 text-[10px] text-gray-400 hover:text-black border border-gray-200 rounded transition"
      >
        フィルターをクリア
      </button>
    </div>
  );
}
