"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SPECIALTIES = [
  { key: "FLORAL", label: "Floral" },
  { key: "WOODY", label: "Woody" },
  { key: "CITRUS", label: "Citrus" },
  { key: "ORIENTAL", label: "Oriental" },
  { key: "FRESH", label: "Fresh" },
  { key: "GOURMAND", label: "Gourmand" },
] as const;

const TIERS = [
  { key: "", label: "ティア" },
  { key: "GRAND_MASTER", label: "◆ Grand Master" },
  { key: "MASTER", label: "◆ Master 以上" },
  { key: "EXPERT", label: "◆ Expert 以上" },
  { key: "ARTISAN", label: "◆ Artisan 以上" },
] as const;

export default function CreatorsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const currentSpecialty = searchParams.get("specialty") ?? "";
  const currentTier = searchParams.get("tier") ?? "";
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
    // Reset page when filters change
    params.delete("page");
    const qs = params.toString();
    return `/creators${qs ? `?${qs}` : ""}`;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ search: searchValue || null }));
  }

  function handleSpecialtyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    router.push(buildUrl({ specialty: next }));
  }

  function handleTierChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    router.push(buildUrl({ tier: next }));
  }

  function clearFilter(key: string) {
    router.push(buildUrl({ [key]: null }));
  }

  return (
    <div className="flex-1 flex items-center gap-2">
      {/* Search input */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-gray-200 bg-white"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#999"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="名前・スタイル・キーワードで検索"
          className="flex-1 text-xs outline-none bg-transparent placeholder-gray-300"
        />
      </form>

      {/* Category dropdown */}
      <select
        value={currentSpecialty}
        onChange={handleSpecialtyChange}
        className="px-3 py-2 rounded border border-gray-200 text-[11px] text-gray-600 bg-white outline-none"
      >
        <option value="">カテゴリ</option>
        {SPECIALTIES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Tier dropdown */}
      <select
        value={currentTier}
        onChange={handleTierChange}
        className="px-3 py-2 rounded border border-gray-200 text-[11px] text-gray-600 bg-white outline-none"
      >
        {TIERS.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Active filter tags */}
      {(currentSpecialty || currentTier || currentSearch) && (
        <div className="flex items-center gap-1">
          {currentSpecialty && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black text-white text-[10px]">
              {SPECIALTIES.find((s) => s.key === currentSpecialty)?.label ??
                currentSpecialty}
              <button
                onClick={() => clearFilter("specialty")}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                x
              </button>
            </span>
          )}
          {currentTier && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black text-white text-[10px]">
              {currentTier.replace("_", " ")}
              <button
                onClick={() => clearFilter("tier")}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                x
              </button>
            </span>
          )}
          {currentSearch && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black text-white text-[10px]">
              &quot;{currentSearch}&quot;
              <button
                onClick={() => {
                  setSearchValue("");
                  clearFilter("search");
                }}
                className="ml-0.5 opacity-70 hover:opacity-100"
              >
                x
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
