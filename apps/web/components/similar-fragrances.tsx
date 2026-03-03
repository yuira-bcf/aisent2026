"use client";

import type { SimilarResult } from "@/lib/fragrance-map/types";

type Props = {
  results: SimilarResult[];
};

export default function SimilarFragrances({ results }: Props) {
  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        あなたの香りに近いフレグランス
      </h3>
      <div className="space-y-3">
        {results.map((result, index) => {
          const pct = Math.round(result.similarity * 100);
          return (
            <div key={result.fragrance.id} className="flex items-start gap-3">
              <span className="text-xs font-bold text-gray-300 mt-0.5 w-5 shrink-0">
                #{index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-black truncate">
                    {result.fragrance.nameJa}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    類似度 {pct}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {result.fragrance.brand} / {result.fragrance.category}
                </p>
                {/* Progress bar */}
                <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
