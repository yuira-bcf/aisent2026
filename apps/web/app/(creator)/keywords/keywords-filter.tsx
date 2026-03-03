"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTER_OPTIONS = [
  { key: "all", label: "全て" },
  { key: "undefined", label: "未定義" },
  { key: "defined", label: "定義済" },
] as const;

export default function KeywordsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") ?? "all";

  function handleFilterClick(filter: string) {
    if (filter === "all") {
      router.push("/keywords");
    } else {
      router.push(`/keywords?filter=${filter}`);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-6">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleFilterClick(opt.key)}
          className={`px-3 py-1.5 text-xs transition ${
            currentFilter === opt.key
              ? "bg-black text-white"
              : "border border-gray-200 text-gray-500 hover:border-black"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
