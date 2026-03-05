"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const sortOptions = [
  { label: "新着順", value: "newest" },
  { label: "人気順", value: "popular" },
  { label: "価格 安い順", value: "price-asc" },
  { label: "価格 高い順", value: "price-desc" },
  { label: "評価順", value: "rating" },
  { label: "レビュー数順", value: "reviews" },
  { label: "売上順", value: "sales" },
] as const;

export default function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-600 rounded focus:border-black focus:outline-none"
    >
      {sortOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
