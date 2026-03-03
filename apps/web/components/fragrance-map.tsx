"use client";

import { REFERENCE_FRAGRANCES } from "@/lib/fragrance-map/reference-fragrances";
import type { MapPosition, SimilarResult } from "@/lib/fragrance-map/types";

type Props = {
  userPosition: MapPosition;
  similarFragrances: SimilarResult[];
};

function toPercent(val: number): number {
  // Map from [-1, 1] to [5%, 95%]
  return ((val + 1) / 2) * 90 + 5;
}

const PINK_SHADES = ["bg-pink-400", "bg-pink-300", "bg-pink-200"];

export default function FragranceMap({
  userPosition,
  similarFragrances,
}: Props) {
  const similarIds = new Set(similarFragrances.map((s) => s.fragrance.id));

  const referencePoints = REFERENCE_FRAGRANCES.filter(
    (f) => !similarIds.has(f.id),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          フレグランスマップ
        </h3>
        {similarFragrances.length > 0 && (
          <div className="flex items-center gap-2 text-[9px]">
            <span className="text-gray-400">近い香り:</span>
            {similarFragrances.slice(0, 3).map((s, i) => (
              <span key={s.fragrance.id} className="flex items-center gap-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${PINK_SHADES[i] ?? "bg-pink-200"}`}
                />
                {s.fragrance.nameJa}
                <span className="text-gray-400">
                  {Math.round(s.similarity * 100)}%
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="relative bg-gray-50 border border-gray-100 flex-1 min-h-0">
        {/* Cross axes */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />

        {/* Axis labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-blue-500">
          &#x2190; フレッシュ
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-red-500">
          ウォーム &#x2192;
        </span>
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-pink-500">
          フローラル &#x2191;
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-green-700">
          &#x2193; ウッディ
        </span>

        {/* Reference dots (gray) */}
        {referencePoints.map((f) => (
          <div
            key={f.id}
            className="scatter-dot bg-gray-300"
            style={{
              left: `${toPercent(f.position.x)}%`,
              top: `${100 - toPercent(f.position.y)}%`,
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              position: "absolute",
            }}
            title={f.nameJa}
          />
        ))}

        {/* Similar dots (pink, highlighted) */}
        {similarFragrances.slice(0, 3).map((s, i) => (
          <div
            key={s.fragrance.id}
            className={`scatter-dot ${PINK_SHADES[i] ?? "bg-pink-200"}`}
            style={{
              left: `${toPercent(s.fragrance.position.x)}%`,
              top: `${100 - toPercent(s.fragrance.position.y)}%`,
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              position: "absolute",
            }}
            title={`#${i + 1} ${s.fragrance.nameJa}`}
          />
        ))}

        {/* User position (black dot with ring) */}
        <div
          className="scatter-user bg-black"
          style={{
            left: `${toPercent(userPosition.x)}%`,
            top: `${100 - toPercent(userPosition.y)}%`,
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            position: "absolute",
            border: "2px solid #fff",
            boxShadow: "0 0 0 2px #000",
          }}
        />
      </div>
    </div>
  );
}
