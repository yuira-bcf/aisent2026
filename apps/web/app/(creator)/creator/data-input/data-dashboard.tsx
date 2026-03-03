"use client";

import Link from "next/link";

type Counts = {
  flavorNotes: number;
  prohibited: number;
  compatibility: number;
  theme: number;
  recipes: number;
};

const LAYERS = [
  {
    label: "L1 素材物性",
    description: "香料ごとの揮発性・強さ・重さ・温度感",
    color: "border-gray-300",
  },
  {
    label: "L1 相性",
    description: "香料ペアの相性スコア (-1.0 ~ +1.0)",
    color: "border-gray-300",
  },
  {
    label: "L2 シーン",
    description: "オフィス / デート / パーティー等",
    color: "border-gray-400",
  },
  {
    label: "L3 ムード",
    description: "爽やか / 情熱的 / 優雅 等",
    color: "border-gray-500",
  },
  {
    label: "L4 世界観",
    description: "都会的 / 自然派 / ヴィンテージ 等",
    color: "border-gray-600",
  },
  {
    label: "L5 関係",
    description: "自分用 / パートナー向け / プレゼント用",
    color: "border-gray-700",
  },
];

type Section = {
  label: string;
  icon: string;
  count: number;
  recommended: number;
  unit: string;
  href: string;
};

export function DataDashboard({ counts }: { counts: Counts }) {
  const sections: Section[] = [
    {
      label: "香料物性",
      icon: "science",
      count: counts.flavorNotes,
      recommended: 50,
      unit: "件",
      href: "/creator/data-input/flavors",
    },
    {
      label: "禁止ペア",
      icon: "block",
      count: counts.prohibited,
      recommended: 20,
      unit: "件",
      href: "/creator/data-input/prohibited",
    },
    {
      label: "相性スコア",
      icon: "compare_arrows",
      count: counts.compatibility,
      recommended: 200,
      unit: "件",
      href: "/creator/data-input/compatibility",
    },
    {
      label: "テーマ軸",
      icon: "category",
      count: counts.theme,
      recommended: 15,
      unit: "件",
      href: "/creator/data-input/evaluation",
    },
    {
      label: "レシピ",
      icon: "menu_book",
      count: counts.recipes,
      recommended: 0,
      unit: "件",
      href: "/creator/recipes",
    },
  ];

  return (
    <div>
      {/* 5-layer architecture */}
      <div className="border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-bold text-black mb-4">5層アーキテクチャ</h2>
        <div className="space-y-2">
          {LAYERS.map((layer) => (
            <div
              key={layer.label}
              className={`border-l-4 ${layer.color} pl-3 py-2`}
            >
              <p className="text-sm font-medium text-black">{layer.label}</p>
              <p className="text-xs text-gray-400">{layer.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bars */}
      <div className="border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-bold text-black mb-4">入力進捗</h2>
        <div className="space-y-4">
          {sections.map((s) => {
            const pct =
              s.recommended > 0
                ? Math.min(100, Math.round((s.count / s.recommended) * 100))
                : 100;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      {s.icon}
                    </span>
                    {s.label}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {s.count}
                    {s.unit}
                    {s.recommended > 0 && ` / ${s.recommended}${s.unit}推奨`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 w-full">
                  <div
                    className="h-2 bg-black transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="border border-gray-200 p-4 hover:border-black transition group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-xl text-gray-400 group-hover:text-black transition">
                {s.icon}
              </span>
              <span className="text-sm font-medium text-black">{s.label}</span>
            </div>
            <p className="text-xs text-gray-400">
              {s.count}
              {s.unit}登録済
            </p>
          </Link>
        ))}
        <Link
          href="/creator/recipes/new-advanced"
          className="border border-gray-200 p-4 hover:border-black transition group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-xl text-gray-400 group-hover:text-black transition">
              auto_awesome
            </span>
            <span className="text-sm font-medium text-black">
              高度なレシピ作成
            </span>
          </div>
          <p className="text-xs text-gray-400">5層テーマ軸でレシピを作成</p>
        </Link>
      </div>
    </div>
  );
}
